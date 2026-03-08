#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3302}"
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

# create command chain root
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"传导幂等验证","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒内"}' \
  >"$TMP_DIR/draft.json"
DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu"}' >"$TMP_DIR/issue.json"
COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" \
  -H "content-type: application/json" \
  --data-binary '{"rootNodeId":"captain-A"}' >/dev/null

# captain understands first
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/understanding" \
  -H "content-type: application/json" \
  -H "x-node-id: captain-A" \
  --data-binary '{"understandingStatus":"UNDERSTOOD","question":"无疑问"}' >/dev/null

# same propagation twice
for _ in 1 2; do
  curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/propagate" \
    -H "content-type: application/json" \
    -H "x-node-id: captain-A" \
    --data-binary '{"targetNodeIds":["member-A1"]}' >/dev/null
done

curl -fsS "$API_BASE/commands/audit/timeline?commandId=$COMMAND_ID&eventType=CommandPropagated" \
  >"$TMP_DIR/events.json"

COUNT="$(node -e "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const n=(d.events||[]).filter(e=>e.payload?.toNodeId==='member-A1').length;console.log(n)" "$TMP_DIR/events.json")"
if [[ "$COUNT" != "1" ]]; then
  echo "[error] expected 1 CommandPropagated event for member-A1, got $COUNT"
  cat "$TMP_DIR/events.json"
  exit 21
fi

echo "SMOKE PASS: propagation idempotency is healthy."
