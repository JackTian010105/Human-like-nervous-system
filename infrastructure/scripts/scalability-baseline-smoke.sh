#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3310}"
API_BASE="http://localhost:${API_PORT}"
COMMAND_COUNT="${COMMAND_COUNT:-100}"
CONCURRENCY="${CONCURRENCY:-20}"
TARGET_P95_MS="${TARGET_P95_MS:-5000}"
TARGET_SUCCESS_RATE="${TARGET_SUCCESS_RATE:-0.99}"

TMP_DIR="$(mktemp -d)"
API_LOG="$TMP_DIR/command-api.log"
API_PID_FILE="$TMP_DIR/command-api.pid"
SUCCESS_FILE="$TMP_DIR/success_ms.txt"
FAIL_FILE="$TMP_DIR/failures.log"
RESULT_FILE="$TMP_DIR/result.json"

cleanup() {
  if [[ -f "$API_PID_FILE" ]]; then
    kill "$(cat "$API_PID_FILE")" 2>/dev/null || true
    wait "$(cat "$API_PID_FILE")" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ ! -f "apps/command-api/dist/main.js" ]]; then
  echo "[setup] command-api dist not found, building..."
  pnpm --filter command-api build >/dev/null
fi

echo "[start] launching command-api on :$API_PORT"
PORT="$API_PORT" node apps/command-api/dist/main.js >"$API_LOG" 2>&1 &
echo $! >"$API_PID_FILE"

for _ in $(seq 1 30); do
  if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "$API_BASE/health" >/dev/null; then
  echo "[error] api health check failed"
  tail -n 80 "$API_LOG" || true
  exit 70
fi

echo "[run] creating $COMMAND_COUNT chains with concurrency=$CONCURRENCY"

API_BASE="$API_BASE" \
COMMAND_COUNT="$COMMAND_COUNT" \
CONCURRENCY="$CONCURRENCY" \
SUCCESS_FILE="$SUCCESS_FILE" \
FAIL_FILE="$FAIL_FILE" \
RESULT_FILE="$RESULT_FILE" \
node <<'NODE'
const fs = require("fs");
const { performance } = require("perf_hooks");

const API_BASE = process.env.API_BASE;
const commandCount = Number.parseInt(process.env.COMMAND_COUNT ?? "100", 10);
const concurrency = Number.parseInt(process.env.CONCURRENCY ?? "20", 10);
const successFile = process.env.SUCCESS_FILE;
const failFile = process.env.FAIL_FILE;
const resultFile = process.env.RESULT_FILE;

const failures = [];
const latencies = [];
let nextIndex = 1;

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });
  const text = await res.text();
  let json = {};
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  if (!res.ok) {
    const message = json?.message ?? `HTTP_${res.status}`;
    throw new Error(String(message));
  }
  return json;
}

async function runChain(idx) {
  const start = performance.now();
  try {
    const draft = await postJson(`${API_BASE}/commands/drafts`, {
      content: `压测指令-${idx}`,
      targetNode: "队长A",
      executionRequirement: "立即",
      feedbackRequirement: "30秒内"
    });
    const draftId = draft?.draft?.draftId;
    if (!draftId) {
      throw new Error("missing_draft_id");
    }

    const issued = await postJson(
      `${API_BASE}/commands/drafts/${draftId}/issue`,
      { issuerId: `sunwu-scale-${idx}` },
      { "Idempotency-Key": `scale:${draftId}` }
    );
    const commandId = issued?.command?.commandId;
    if (!commandId) {
      throw new Error("missing_command_id");
    }

    await postJson(`${API_BASE}/commands/${commandId}/root-node`, {
      rootNodeId: "captain-A"
    });

    latencies.push(performance.now() - start);
  } catch (error) {
    failures.push(`chain=${idx} error=${error.message}`);
  }
}

async function worker() {
  while (true) {
    const current = nextIndex;
    nextIndex += 1;
    if (current > commandCount) {
      return;
    }
    await runChain(current);
  }
}

async function main() {
  const workerCount = Math.max(1, Math.min(concurrency, commandCount));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  fs.writeFileSync(successFile, latencies.map((x) => x.toFixed(3)).join("\n"), "utf8");
  fs.writeFileSync(failFile, failures.join("\n"), "utf8");
  fs.writeFileSync(resultFile, JSON.stringify({ successCount: latencies.length, failCount: failures.length }), "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

SUCCESS_COUNT="$(node -e "const x=require('fs').readFileSync(process.argv[1],'utf8');const j=JSON.parse(x);console.log(j.successCount)" "$RESULT_FILE")"
FAIL_COUNT="$(node -e "const x=require('fs').readFileSync(process.argv[1],'utf8');const j=JSON.parse(x);console.log(j.failCount)" "$RESULT_FILE")"

SUCCESS_RATE="$(awk "BEGIN {printf \"%.4f\", $SUCCESS_COUNT/$COMMAND_COUNT}")"
P95_MS="0"
if [[ "$SUCCESS_COUNT" -gt 0 ]]; then
  P95_MS="$(node -e '
const fs=require("fs");
const text=fs.readFileSync(process.argv[1],"utf8").trim();
if(!text){console.log("0");process.exit(0);}
const arr=text.split(/\s+/).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
const idx=Math.max(0,Math.ceil(arr.length*0.95)-1);
console.log(arr[idx].toFixed(3));
' "$SUCCESS_FILE")"
fi

echo "[result] success=$SUCCESS_COUNT failure=$FAIL_COUNT total=$COMMAND_COUNT"
echo "[result] success_rate=$SUCCESS_RATE target>=$TARGET_SUCCESS_RATE"
echo "[result] p95_chain_latency_ms=$P95_MS target<=$TARGET_P95_MS"

REPORT_DIR="$ROOT_DIR/docs/reports"
LATEST_REPORT="$ROOT_DIR/docs/scalability-baseline-latest.json"
HISTORY_MD="$ROOT_DIR/docs/scalability-baseline-history.md"
mkdir -p "$REPORT_DIR"
STAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
STAMP_FILE="$(date -u +"%Y%m%dT%H%M%SZ")"
REPORT_FILE="$REPORT_DIR/scalability-baseline-$STAMP_FILE.json"
cat >"$REPORT_FILE" <<JSON
{
  "timestamp": "$STAMP_UTC",
  "commandCount": $COMMAND_COUNT,
  "concurrency": $CONCURRENCY,
  "successCount": $SUCCESS_COUNT,
  "failCount": $FAIL_COUNT,
  "successRate": $SUCCESS_RATE,
  "p95LatencyMs": $P95_MS,
  "targets": {
    "successRateGte": $TARGET_SUCCESS_RATE,
    "p95LatencyMsLte": $TARGET_P95_MS
  }
}
JSON
cp "$REPORT_FILE" "$LATEST_REPORT"

if [[ ! -f "$HISTORY_MD" ]]; then
  cat >"$HISTORY_MD" <<'MD'
# Scalability Baseline History

| Timestamp (UTC) | Command Count | Concurrency | Success Rate | P95 Latency (ms) |
| --- | ---: | ---: | ---: | ---: |
MD
fi
printf '| %s | %s | %s | %s | %s |\n' "$STAMP_UTC" "$COMMAND_COUNT" "$CONCURRENCY" "$SUCCESS_RATE" "$P95_MS" >>"$HISTORY_MD"
echo "[report] latest=$LATEST_REPORT"
echo "[report] snapshot=$REPORT_FILE"

if ! awk "BEGIN {exit !($SUCCESS_RATE >= $TARGET_SUCCESS_RATE)}"; then
  echo "[error] success rate below target"
  [[ -f "$FAIL_FILE" ]] && tail -n 30 "$FAIL_FILE" || true
  exit 71
fi

if ! awk "BEGIN {exit !($P95_MS <= $TARGET_P95_MS)}"; then
  echo "[error] P95 latency above target"
  exit 72
fi

echo "SMOKE PASS: scalability baseline is healthy."
