#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3309}"
API_BASE="http://localhost:${API_PORT}"
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

echo "[step] reject forbidden role for node config update"
STATUS="$(curl -sS -o "$TMP_DIR/forbidden.json" -w '%{http_code}' -X PATCH "$API_BASE/commands/nodes/captain-A/config" \
  -H "content-type: application/json" \
  -H "x-operator-role: BIANQUE" \
  --data-binary '{"nodeName":"队长A-禁用尝试"}')"
if [[ "$STATUS" != "403" ]]; then
  echo "[error] expected 403 for forbidden role, got $STATUS"
  cat "$TMP_DIR/forbidden.json"
  exit 41
fi

echo "[step] reject invalid config payload"
STATUS="$(curl -sS -o "$TMP_DIR/invalid_payload.json" -w '%{http_code}' -X PATCH "$API_BASE/commands/nodes/captain-A/config" \
  -H "content-type: application/json" \
  -H "x-operator-role: GUANNING" \
  --data-binary '{"roleType":"INVALID"}')"
if [[ "$STATUS" != "400" ]]; then
  echo "[error] expected 400 for invalid roleType, got $STATUS"
  cat "$TMP_DIR/invalid_payload.json"
  exit 42
fi

echo "[step] update node config with allowed role"
curl -fsS -X PATCH "$API_BASE/commands/nodes/captain-A/config" \
  -H "content-type: application/json" \
  -H "x-operator-role: GUANNING" \
  --data-binary '{"nodeName":"队长A-新","roleType":"CAPTAIN","active":true,"chainPosition":"A-CAPTAIN"}' \
  >"$TMP_DIR/update.json"
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(j.node.nodeId!=="captain-A"){throw new Error("node id mismatch")}
if(j.node.nodeName!=="队长A-新"){throw new Error("nodeName not updated")}
if(j.auditEvent.eventType!=="NodeConfigUpdated"){throw new Error("missing NodeConfigUpdated audit")}
' "$TMP_DIR/update.json"

echo "[step] diagnostics visible to BIANQUE"
curl -fsS "$API_BASE/commands/nodes/captain-A/diagnostics" \
  -H "x-operator-role: BIANQUE" \
  >"$TMP_DIR/diagnostics.json"
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(!j.diagnostics?.node){throw new Error("diagnostics node missing")}
if(j.diagnostics.node.nodeId!=="captain-A"){throw new Error("diagnostics node mismatch")}
if(!Array.isArray(j.diagnostics.recentEvents)){throw new Error("recentEvents missing")}
' "$TMP_DIR/diagnostics.json"

echo "[step] trigger recovery"
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/recovery" \
  -H "content-type: application/json" \
  -H "x-operator-role: BIANQUE" \
  --data-binary '{"reason":"manual_smoke_recovery"}' \
  >"$TMP_DIR/recovery.json"
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(j.nodeId!=="captain-A"){throw new Error("nodeId mismatch")}
if(j.recoveryStatus!=="RECOVERING"){throw new Error("expected RECOVERING")}
if(j.eventType!=="RecoveryTriggered"){throw new Error("missing RecoveryTriggered")}
' "$TMP_DIR/recovery.json"

echo "[step] recovery event is traceable in system audit timeline"
curl -fsS "$API_BASE/commands/audit/timeline?commandId=SYSTEM&nodeId=captain-A&eventType=RecoveryTriggered" \
  >"$TMP_DIR/recovery_timeline.json"
node -e '
const fs=require("fs");
const events=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).events || [];
if(events.length < 1){throw new Error("RecoveryTriggered not found in timeline")}
console.log("SMOKE PASS: node ops config/diagnostics/recovery flow is healthy.");
' "$TMP_DIR/recovery_timeline.json"

