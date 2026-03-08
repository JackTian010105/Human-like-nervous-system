#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3305}"
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

# create command and route to captain-A
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"聚合幂等验证","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒内"}' \
  >"$TMP_DIR/draft.json"
DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu"}' >"$TMP_DIR/issue.json"
COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" \
  -H "content-type: application/json" \
  --data-binary '{"rootNodeId":"captain-A"}' >/dev/null

# captain propagate to member-A1 and member-A2
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/understanding" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary '{"understandingStatus":"UNDERSTOOD","question":"无疑问"}' >/dev/null
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/propagate" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary '{"targetNodeIds":["member-A1","member-A2"]}' >/dev/null

# only member-A1 reports, member-A2 remains pending
curl -fsS -X POST "$API_BASE/commands/nodes/member-A1/commands/$COMMAND_ID/execution-feedback" \
  -H "content-type: application/json" \
  -H "x-node-id: member-A1" \
  --data-binary '{"executionStatus":"COMPLETED"}' >/dev/null

# same aggregation twice
for _ in 1 2; do
  curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/feedback-aggregation" \
    -H "x-node-id: captain-A" >/dev/null
done

curl -fsS "$API_BASE/commands/audit/timeline?commandId=$COMMAND_ID&eventType=FeedbackReturned" \
  >"$TMP_DIR/events.json"
node -e '
const fs=require("fs");
const events=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).events || [];
if(events.length!==1){throw new Error(`expected 1 FeedbackReturned, got ${events.length}`)}
const p=events[0].payload||{};
if(p.completedCount!==1 || p.pendingCount!==2){throw new Error("aggregation payload mismatch")}
if(!Array.isArray(p.pendingNodeIds)){throw new Error("pending node list missing")}
if(!p.pendingNodeIds.includes("member-A2") || !p.pendingNodeIds.includes("member-A3")){
  throw new Error("pending node list mismatch")
}
if(!p.aggregatedAt){throw new Error("aggregatedAt missing")}
console.log("SMOKE PASS: feedback aggregation idempotency is healthy.");
' "$TMP_DIR/events.json"
