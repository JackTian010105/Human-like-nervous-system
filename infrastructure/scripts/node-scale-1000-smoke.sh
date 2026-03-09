#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3311}"
API_BASE="http://localhost:${API_PORT}"
NODE_COUNT="${NODE_COUNT:-1000}"
REGISTER_CONCURRENCY="${REGISTER_CONCURRENCY:-40}"
TARGET_PROPAGATION_MS="${TARGET_PROPAGATION_MS:-5000}"
TMP_DIR="$(mktemp -d)"
API_PID_FILE="$TMP_DIR/command-api.pid"
API_LOG="$TMP_DIR/command-api.log"

cleanup() {
  if [[ -f "$API_PID_FILE" ]]; then
    kill "$(cat "$API_PID_FILE")" 2>/dev/null || true
    wait "$(cat "$API_PID_FILE")" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ ! -f "apps/command-api/dist/main.js" ]]; then
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
curl -fsS "$API_BASE/health" >/dev/null

echo "[step] register $NODE_COUNT member nodes under captain-A"
API_BASE="$API_BASE" NODE_COUNT="$NODE_COUNT" REGISTER_CONCURRENCY="$REGISTER_CONCURRENCY" node <<'NODE'
const base = process.env.API_BASE;
const total = Number.parseInt(process.env.NODE_COUNT ?? "1000", 10);
const concurrency = Number.parseInt(process.env.REGISTER_CONCURRENCY ?? "40", 10);

let next = 1;
let success = 0;
let failed = 0;
const errors = [];

async function registerOne(i) {
  const nodeId = `member-scale-${i}`;
  const body = {
    nodeId,
    nodeName: `规模节点-${i}`,
    roleType: "MEMBER",
    parentNodeId: "captain-A",
    chainPosition: `LEVEL_2_SCALE_${i}`,
    active: true
  };
  const res = await fetch(`${base}/commands/nodes/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-operator-role": "GUANNING"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}:${json?.message ?? "register_failed"}`);
  }
  if (!json?.node?.nodeId) {
    throw new Error("missing_node_in_response");
  }
}

async function worker() {
  while (true) {
    const current = next;
    next += 1;
    if (current > total) return;
    try {
      await registerOne(current);
      success += 1;
    } catch (err) {
      failed += 1;
      errors.push(`idx=${current} err=${err.message}`);
    }
  }
}

async function main() {
  const n = Math.max(1, Math.min(concurrency, total));
  await Promise.all(Array.from({ length: n }, () => worker()));
  if (failed > 0) {
    console.error(errors.slice(0, 20).join("\n"));
    throw new Error(`registration_failed success=${success} failed=${failed}`);
  }
  console.log(`[assert] registered nodes success=${success}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
NODE

echo "[step] validate downstream candidate size"
curl -fsS "$API_BASE/commands/nodes/captain-A/downstream-candidates" \
  -H "x-node-id: captain-A" >"$TMP_DIR/downstream.json"
node -e '
const fs=require("fs");
const total=Number.parseInt(process.argv[2],10);
const nodeIds=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).nodeIds||[];
const scaleCount=nodeIds.filter((id)=>id.startsWith("member-scale-")).length;
if(scaleCount!==total){throw new Error(`expected ${total} scale nodes, got ${scaleCount}`)}
console.log(`[assert] downstream contains ${scaleCount} registered scale nodes`);
' "$TMP_DIR/downstream.json" "$NODE_COUNT"

echo "[step] create + issue + bind command"
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"1000节点传导压测","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒内"}' \
  >"$TMP_DIR/draft.json"
DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu-scale-1000"}' >"$TMP_DIR/issue.json"
COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" \
  -H "content-type: application/json" \
  --data-binary '{"rootNodeId":"captain-A"}' >/dev/null
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/understanding" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary '{"understandingStatus":"UNDERSTOOD","question":"无疑问"}' >/dev/null

echo "[step] propagate to all registered nodes"
node -e '
const fs=require("fs");
const total=Number.parseInt(process.argv[2],10);
const ids=Array.from({length:total},(_,i)=>`member-scale-${i+1}`);
fs.writeFileSync(process.argv[1],JSON.stringify({targetNodeIds:ids}));
' "$TMP_DIR/propagate-payload.json" "$NODE_COUNT"

PROPAGATE_MS="$(curl -fsS -o "$TMP_DIR/propagate.json" -w '%{time_total}' -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/propagate" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary "@$TMP_DIR/propagate-payload.json")"
PROPAGATE_MS="$(awk "BEGIN {printf \"%.3f\", $PROPAGATE_MS * 1000}")"

node -e '
const fs=require("fs");
const expected=Number.parseInt(process.argv[2],10);
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(!Array.isArray(j.propagated)||j.propagated.length!==expected){
  throw new Error(`expected propagated=${expected}, got ${j.propagated?.length ?? -1}`);
}
if((j.invalidTargets||[]).length!==0){
  throw new Error(`invalidTargets should be empty, got ${(j.invalidTargets||[]).length}`);
}
console.log(`[assert] propagated=${j.propagated.length} invalidTargets=0`);
' "$TMP_DIR/propagate.json" "$NODE_COUNT"

echo "[step] verify chain node count"
curl -fsS "$API_BASE/commands/$COMMAND_ID/chain" >"$TMP_DIR/chain.json"
node -e '
const fs=require("fs");
const expected=Number.parseInt(process.argv[2],10) + 1;
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(!Array.isArray(j.nodes)||j.nodes.length<expected){
  throw new Error(`expected at least ${expected} chain nodes, got ${j.nodes?.length ?? -1}`);
}
console.log(`[assert] chain nodes=${j.nodes.length} (expected>=${expected})`);
' "$TMP_DIR/chain.json" "$NODE_COUNT"

echo "[result] propagation_latency_ms=$PROPAGATE_MS target<=$TARGET_PROPAGATION_MS"
if ! awk "BEGIN {exit !($PROPAGATE_MS <= $TARGET_PROPAGATION_MS)}"; then
  echo "[error] propagation latency above target"
  exit 81
fi

echo "SMOKE PASS: node scale 1000 registration and propagation are healthy."

