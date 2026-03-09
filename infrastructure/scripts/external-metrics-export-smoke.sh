#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3312}"
API_BASE="http://localhost:${API_PORT}"
TOKEN="${EXTERNAL_API_TOKEN:-dev-external-token}"
TMP_DIR="$(mktemp -d)"
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
  pnpm --filter command-api build >/dev/null
fi

PORT="$API_PORT" node apps/command-api/dist/main.js >"$TMP_DIR/api.log" 2>&1 &
echo $! >"$API_PID_FILE"

for _ in $(seq 1 30); do
  if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "$API_BASE/health" >/dev/null

echo "[step] generate unauthorized and bad-request samples"
curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_BASE/api/external/commands" \
  -H "content-type: application/json" \
  -H "x-external-token: bad-token" \
  -H "idempotency-key: test-unauth-1" \
  --data-binary '{"externalSystemId":"mozi-system","content":"x","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' \
  >"$TMP_DIR/status-unauth.txt"

curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_BASE/api/external/commands" \
  -H "content-type: application/json" \
  -H "x-external-token: ${TOKEN}" \
  --data-binary '{"externalSystemId":"mozi-system","content":"x","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' \
  >"$TMP_DIR/status-bad.txt"

echo "[step] generate success samples and callback deliveries"
curl -fsS -X POST "$API_BASE/api/external/callbacks/register" \
  -H "content-type: application/json" \
  -H "x-external-token: ${TOKEN}" \
  --data-binary '{"externalSystemId":"mozi-system","callbackUrl":"https://callback.success/mock","signingSecret":"secret-success"}' >/dev/null

curl -fsS -X POST "$API_BASE/api/external/callbacks/register" \
  -H "content-type: application/json" \
  -H "x-external-token: ${TOKEN}" \
  --data-binary '{"externalSystemId":"mozi-system","callbackUrl":"https://callback.fail/mock","signingSecret":"secret-fail"}' >/dev/null

curl -fsS -X POST "$API_BASE/api/external/commands" \
  -H "content-type: application/json" \
  -H "x-external-token: ${TOKEN}" \
  -H "idempotency-key: test-success-1" \
  --data-binary '{"externalSystemId":"mozi-system","content":"外部测试","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' >/dev/null

echo "[step] query metrics export"
curl -fsS "$API_BASE/api/external/metrics?windowMinutes=60" \
  -H "x-external-token: ${TOKEN}" >"$TMP_DIR/metrics.json"

node -e '
const fs=require("fs");
const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(!m.apiRequests || !m.callbackDeliveries){throw new Error("metrics shape invalid")}
if(m.apiRequests.total < 3){throw new Error(`apiRequests.total too small: ${m.apiRequests.total}`)}
if(m.apiRequests.unauthorized < 1){throw new Error("unauthorized count missing")}
if(m.apiRequests.badRequest < 1){throw new Error("badRequest count missing")}
if(m.apiRequests.success < 1){throw new Error("success count missing")}
if(m.callbackDeliveries.total < 2){throw new Error(`callback total too small: ${m.callbackDeliveries.total}`)}
if(m.callbackDeliveries.failed < 1){throw new Error("failed callback count missing")}
if(m.callbackDeliveries.success < 1){throw new Error("success callback count missing")}
console.log("SMOKE PASS: external metrics export is healthy.");
' "$TMP_DIR/metrics.json"
