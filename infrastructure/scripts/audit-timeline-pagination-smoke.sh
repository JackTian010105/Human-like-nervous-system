#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3308}"
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

# produce enough events for one command
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"分页验证","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' \
  >"$TMP_DIR/draft.json"
DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" -H "content-type: application/json" -d '{"issuerId":"sunwu"}' >"$TMP_DIR/issue.json"
COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" -H "content-type: application/json" -d '{"rootNodeId":"captain-A"}' >/dev/null
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/understanding" -H "content-type: application/json" -H "x-node-id: captain-A" -d '{"understandingStatus":"UNDERSTOOD"}' >/dev/null
curl -fsS -X POST "$API_BASE/commands/nodes/captain-A/commands/$COMMAND_ID/propagate" -H "content-type: application/json" -H "x-node-id: captain-A" -d '{"targetNodeIds":["member-A1","member-A2","member-A3"]}' >/dev/null

curl -fsS "$API_BASE/commands/audit/timeline?commandId=$COMMAND_ID&page=1&pageSize=3" >"$TMP_DIR/page1.json"
curl -fsS "$API_BASE/commands/audit/timeline?commandId=$COMMAND_ID&page=2&pageSize=3" >"$TMP_DIR/page2.json"

node -e '
const fs=require("fs");
const p1=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const p2=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(!p1.pagination || !p2.pagination) throw new Error("missing pagination metadata");
if(p1.pagination.page!==1 || p2.pagination.page!==2) throw new Error("invalid page index");
if(p1.pagination.total!==p2.pagination.total) throw new Error("total mismatch across pages");
const ids1=new Set((p1.events||[]).map((e)=>e.eventId));
const overlap=(p2.events||[]).some((e)=>ids1.has(e.eventId));
if(overlap) throw new Error("duplicate events across pages");
console.log("SMOKE PASS: audit timeline pagination is healthy.");
' "$TMP_DIR/page1.json" "$TMP_DIR/page2.json"
