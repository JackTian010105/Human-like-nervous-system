#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3001}"
API_BASE="http://localhost:${API_PORT}"
TOKEN="${EXTERNAL_API_TOKEN:-dev-external-token}"
TMP_DIR="$(mktemp -d)"
API_LOG="$TMP_DIR/command-api.log"
API_PID_FILE="$TMP_DIR/command-api.pid"

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
sleep 2

echo "[step] register success callback"
cat >"$TMP_DIR/cb_success.json" <<'EOF'
{"externalSystemId":"mozi-system","callbackUrl":"https://partner.example/callback","signingSecret":"secret-123"}
EOF
curl -sS -X POST "$API_BASE/api/external/callbacks/register" \
  -H "content-type: application/json" \
  -H "x-external-token: $TOKEN" \
  --data-binary @"$TMP_DIR/cb_success.json" >"$TMP_DIR/cb_success_resp.json"

echo "[step] register fail callback (retry simulation)"
cat >"$TMP_DIR/cb_fail.json" <<'EOF'
{"externalSystemId":"mozi-system","callbackUrl":"https://partner.example/fail-callback","signingSecret":"secret-fail"}
EOF
curl -sS -X POST "$API_BASE/api/external/callbacks/register" \
  -H "content-type: application/json" \
  -H "x-external-token: $TOKEN" \
  --data-binary @"$TMP_DIR/cb_fail.json" >"$TMP_DIR/cb_fail_resp.json"

echo "[step] create external command"
cat >"$TMP_DIR/cmd.json" <<'EOF'
{"externalSystemId":"mozi-system","content":"E2E command","targetNode":"captain-A","executionRequirement":"immediately","feedbackRequirement":"30s"}
EOF
curl -sS -X POST "$API_BASE/api/external/commands" \
  -H "content-type: application/json" \
  -H "x-external-token: $TOKEN" \
  -H "idempotency-key: e2e-ext-001" \
  --data-binary @"$TMP_DIR/cmd.json" >"$TMP_DIR/create_resp.json"

COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/create_resp.json")"
echo "[info] commandId=$COMMAND_ID"

echo "[step] verify ascending event order reconstruction"
curl -sS "$API_BASE/api/external/events?commandId=$COMMAND_ID&order=asc" \
  -H "x-external-token: $TOKEN" >"$TMP_DIR/events_asc.json"
node -e '
const fs=require("fs");
const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).events;
if (!Array.isArray(data) || data.length === 0) { throw new Error("no events returned"); }
for (let i=1;i<data.length;i+=1){
  if (data[i].eventSequence < data[i-1].eventSequence) throw new Error("event sequence not ascending");
}
console.log("[assert] ascending event sequence OK");
' "$TMP_DIR/events_asc.json"

echo "[step] verify callback deliveries and retry semantics"
curl -sS "$API_BASE/api/external/callbacks/deliveries?commandId=$COMMAND_ID" \
  -H "x-external-token: $TOKEN" >"$TMP_DIR/deliveries.json"
node -e '
const fs=require("fs");
const deliveries=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).deliveries;
if (!Array.isArray(deliveries) || deliveries.length === 0) throw new Error("no callback deliveries");
const hasSuccess=deliveries.some(d=>d.status==="SUCCESS");
const hasFailedRetry=deliveries.some(d=>d.status==="FAILED" && d.attempts===3 && d.maxAttempts===3);
if (!hasSuccess) throw new Error("missing SUCCESS delivery");
if (!hasFailedRetry) throw new Error("missing FAILED delivery with 3 attempts");
console.log("[assert] delivery status/retry semantics OK");
' "$TMP_DIR/deliveries.json"

echo "[step] verify callback signature using helper"
node -e '
const fs=require("fs");
const deliveries=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).deliveries;
const success=deliveries.find(d=>d.status==="SUCCESS");
if(!success) throw new Error("missing success delivery");
fs.writeFileSync(process.argv[2], JSON.stringify(success.payload));
process.stdout.write(success.signatureValue);
' "$TMP_DIR/deliveries.json" "$TMP_DIR/payload.json" >"$TMP_DIR/signature.txt"
SIG="$(cat "$TMP_DIR/signature.txt")"
pnpm -s verify:callback-signature "$TMP_DIR/payload.json" "$SIG" "secret-123" >/dev/null
echo "[assert] signature verification OK"

echo ""
echo "E2E PASS: external integration flow is healthy."
