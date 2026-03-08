#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3303}"
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

# create command and bind root
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"超时恢复验证","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒内"}' \
  >"$TMP_DIR/draft.json"
DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu"}' >"$TMP_DIR/issue.json"
COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" \
  -H "content-type: application/json" \
  --data-binary '{"rootNodeId":"captain-A"}' >/dev/null

# wait and trigger timeout scan
sleep 6
curl -fsS -X POST "$API_BASE/commands/monitor/timeouts/scan" >/dev/null

# compensation: submit understanding
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/understanding" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary '{"understandingStatus":"UNDERSTOOD","question":"补偿回执"}' >/dev/null

# verify event chain
curl -fsS "$API_BASE/commands/audit/timeline?commandId=$COMMAND_ID" >"$TMP_DIR/events.json"
node -e '
const fs=require("fs");
const events=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).events || [];
const timeout=events.find((e)=>e.eventType==="TimeoutDetected");
const recovered=events.find((e)=>e.eventType==="TimeoutRecovered");
if(!timeout){throw new Error("TimeoutDetected missing")}
if(!recovered){throw new Error("TimeoutRecovered missing")}
if(recovered.eventSequence <= timeout.eventSequence){throw new Error("recovery sequence invalid")}
console.log("SMOKE PASS: timeout recovery event chain is healthy.");
' "$TMP_DIR/events.json"
