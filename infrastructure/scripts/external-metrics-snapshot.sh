#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3313}"
API_BASE="http://localhost:${API_PORT}"
TOKEN="${EXTERNAL_API_TOKEN:-dev-external-token}"
WINDOW_MINUTES="${WINDOW_MINUTES:-10080}" # default 7 days
SEED_SAMPLE="${SEED_SAMPLE:-1}"
SEED_PROFILE="${SEED_PROFILE:-baseline}" # baseline | pass

REPORT_DIR="$ROOT_DIR/docs/reports"
HISTORY_MD="$ROOT_DIR/docs/external-metrics-history.md"
WEEKLY_MD="$ROOT_DIR/docs/external-metrics-weekly-trend.md"
LATEST_JSON="$ROOT_DIR/docs/external-metrics-latest.json"

TMP_DIR="$(mktemp -d)"
API_PID_FILE="$TMP_DIR/command-api.pid"
API_LOG="$TMP_DIR/api.log"

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

mkdir -p "$REPORT_DIR"

PORT="$API_PORT" node apps/command-api/dist/main.js >"$API_LOG" 2>&1 &
echo $! >"$API_PID_FILE"

for _ in $(seq 1 30); do
  if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "$API_BASE/health" >/dev/null

if [[ "$SEED_SAMPLE" == "1" ]]; then
  echo "[step] seed a small sample for metrics snapshot"
  if [[ "$SEED_PROFILE" == "baseline" ]]; then
    curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_BASE/api/external/commands" \
      -H "content-type: application/json" \
      -H "x-external-token: bad-token" \
      -H "idempotency-key: snapshot-unauth-1" \
      --data-binary '{"externalSystemId":"mozi-system","content":"x","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' \
      >/dev/null

    curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_BASE/api/external/commands" \
      -H "content-type: application/json" \
      -H "x-external-token: ${TOKEN}" \
      --data-binary '{"externalSystemId":"mozi-system","content":"x","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' \
      >/dev/null

    curl -fsS -X POST "$API_BASE/api/external/callbacks/register" \
      -H "content-type: application/json" \
      -H "x-external-token: ${TOKEN}" \
      --data-binary '{"externalSystemId":"mozi-system","callbackUrl":"https://callback.success/snapshot","signingSecret":"secret-success"}' >/dev/null

    curl -fsS -X POST "$API_BASE/api/external/callbacks/register" \
      -H "content-type: application/json" \
      -H "x-external-token: ${TOKEN}" \
      --data-binary '{"externalSystemId":"mozi-system","callbackUrl":"https://callback.fail/snapshot","signingSecret":"secret-fail"}' >/dev/null

    curl -fsS -X POST "$API_BASE/api/external/commands" \
      -H "content-type: application/json" \
      -H "x-external-token: ${TOKEN}" \
      -H "idempotency-key: snapshot-success-1" \
      --data-binary '{"externalSystemId":"mozi-system","content":"外部快照","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' >/dev/null
  elif [[ "$SEED_PROFILE" == "pass" ]]; then
    curl -fsS -X POST "$API_BASE/api/external/callbacks/register" \
      -H "content-type: application/json" \
      -H "x-external-token: ${TOKEN}" \
      --data-binary '{"externalSystemId":"mozi-system","callbackUrl":"https://callback.success/snapshot-pass","signingSecret":"secret-success-pass"}' >/dev/null

    for i in 1 2 3; do
      curl -fsS -X POST "$API_BASE/api/external/commands" \
        -H "content-type: application/json" \
        -H "x-external-token: ${TOKEN}" \
        -H "idempotency-key: snapshot-pass-$i" \
        --data-binary '{"externalSystemId":"mozi-system","content":"外部PASS快照","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' >/dev/null
    done
  else
    echo "[error] unsupported SEED_PROFILE: $SEED_PROFILE (expected baseline|pass)"
    exit 94
  fi
fi

STAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
STAMP_FILE="$(date -u +"%Y%m%dT%H%M%SZ")"
SNAPSHOT_JSON="$REPORT_DIR/external-metrics-$STAMP_FILE.json"

curl -fsS "$API_BASE/api/external/metrics?windowMinutes=$WINDOW_MINUTES" \
  -H "x-external-token: ${TOKEN}" >"$SNAPSHOT_JSON"
cp "$SNAPSHOT_JSON" "$LATEST_JSON"

if [[ ! -f "$HISTORY_MD" ]]; then
  cat >"$HISTORY_MD" <<'MD'
# External Metrics History

| Timestamp (UTC) | Window (min) | API Availability | Delivery Success | Retry Success |
| --- | ---: | ---: | ---: | ---: |
MD
fi

SUMMARY_LINE="$(node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const ts=j.generatedAt;
const win=j.windowMinutes;
const a=(j.apiRequests.availabilityRate*100).toFixed(2)+"%";
const d=(j.callbackDeliveries.eventDeliverySuccessRate*100).toFixed(2)+"%";
const r=(j.callbackDeliveries.retrySuccessRate*100).toFixed(2)+"%";
console.log(`| ${ts} | ${win} | ${a} | ${d} | ${r} |`);
' "$SNAPSHOT_JSON")"
echo "$SUMMARY_LINE" >>"$HISTORY_MD"

node -e '
const fs=require("fs");
const path=require("path");
const reportDir=process.argv[1];
const weeklyPath=process.argv[2];
const files=fs.readdirSync(reportDir)
  .filter((f)=>/^external-metrics-\d{8}T\d{6}Z\.json$/.test(f))
  .sort()
  .slice(-20);
const rows=files.map((f)=>{
  const j=JSON.parse(fs.readFileSync(path.join(reportDir,f),"utf8"));
  return {
    ts:j.generatedAt,
    api:j.apiRequests.availabilityRate,
    delivery:j.callbackDeliveries.eventDeliverySuccessRate,
    retry:j.callbackDeliveries.retrySuccessRate
  };
});
const cutoff=Date.now()-7*24*60*60*1000;
const weekRows=rows.filter((r)=>new Date(r.ts).getTime()>=cutoff);
const avg=(arr,key)=>arr.length===0?1:arr.reduce((s,x)=>s+x[key],0)/arr.length;
const apiAvg=avg(weekRows,"api");
const deliveryAvg=avg(weekRows,"delivery");
const retryAvg=avg(weekRows,"retry");
let out="# External Metrics Weekly Trend\n\n";
out+=`- Window: last 7 days\n`;
out+=`- Snapshot count: ${weekRows.length}\n`;
out+=`- API Availability Avg: ${(apiAvg*100).toFixed(2)}%\n`;
out+=`- Delivery Success Avg: ${(deliveryAvg*100).toFixed(2)}%\n`;
out+=`- Retry Success Avg: ${(retryAvg*100).toFixed(2)}%\n\n`;
out+="| Timestamp (UTC) | API Availability | Delivery Success | Retry Success |\n";
out+="| --- | ---: | ---: | ---: |\n";
for (const r of weekRows) {
  out+=`| ${r.ts} | ${(r.api*100).toFixed(2)}% | ${(r.delivery*100).toFixed(2)}% | ${(r.retry*100).toFixed(2)}% |\n`;
}
fs.writeFileSync(weeklyPath,out,"utf8");
' "$REPORT_DIR" "$WEEKLY_MD"

echo "[report] snapshot=$SNAPSHOT_JSON"
echo "[report] latest=$LATEST_JSON"
echo "[report] history=$HISTORY_MD"
echo "[report] weekly=$WEEKLY_MD"
echo "EXTERNAL METRICS SNAPSHOT PASS"
