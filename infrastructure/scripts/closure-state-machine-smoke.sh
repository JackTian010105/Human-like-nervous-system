#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3306}"
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

# create command (CREATED) and evaluate closure early -> should reject illegal transition
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"闭环状态机验证","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒内"}' \
  >"$TMP_DIR/draft.json"
DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu"}' >"$TMP_DIR/issue.json"
COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"

curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/evaluate-closure" >"$TMP_DIR/early_eval.json"
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(j.status!=="CREATED"){throw new Error(`expected CREATED, got ${j.status}`)}
if(!Array.isArray(j.unmetConditions) || !j.unmetConditions.some((x)=>String(x).includes("illegal_status_transition"))){
  throw new Error("missing illegal transition reason")
}
' "$TMP_DIR/early_eval.json"

curl -fsS "$API_BASE/commands/audit/timeline?commandId=$COMMAND_ID&eventType=StateTransitionRejected" >"$TMP_DIR/reject_events.json"
node -e '
const fs=require("fs");
const events=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).events||[];
if(events.length<1){throw new Error("StateTransitionRejected not recorded")}
' "$TMP_DIR/reject_events.json"

# now make command closable
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" \
  -H "content-type: application/json" \
  --data-binary '{"rootNodeId":"captain-A"}' >/dev/null
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/understanding" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary '{"understandingStatus":"UNDERSTOOD","question":"无疑问"}' >/dev/null
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/propagate" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary '{"targetNodeIds":["member-A1","member-A2","member-A3"]}' >/dev/null

for node in member-A1 member-A2 member-A3; do
  curl -fsS -X POST "$API_BASE/commands/nodes/$node/commands/$COMMAND_ID/execution-feedback" \
    -H "content-type: application/json" \
    -H "x-node-id: $node" \
    --data-binary '{"executionStatus":"COMPLETED"}' >/dev/null
done

curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/evaluate-closure" >"$TMP_DIR/final_eval.json"
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(j.status!=="CLOSED" || j.isClosed!==true){throw new Error("closure should be CLOSED")}
' "$TMP_DIR/final_eval.json"

curl -fsS "$API_BASE/commands/audit/timeline?commandId=$COMMAND_ID&eventType=CommandClosed" >"$TMP_DIR/closed_events.json"
node -e '
const fs=require("fs");
const events=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).events||[];
if(events.length!==1){throw new Error(`expected 1 CommandClosed, got ${events.length}`)}
console.log("SMOKE PASS: closure state-machine guard and close path are healthy.");
' "$TMP_DIR/closed_events.json"
