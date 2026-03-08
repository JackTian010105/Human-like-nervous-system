#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3307}"
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

# create command in CREATED state
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"下一轮验证","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒内"}' \
  >"$TMP_DIR/draft.json"
DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu"}' >"$TMP_DIR/issue.json"
COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"

# should reject next-round from CREATED
STATUS=$(curl -sS -o "$TMP_DIR/reject.json" -w '%{http_code}' -X POST "$API_BASE/commands/$COMMAND_ID/next-round" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu"}')
if [[ "$STATUS" != "400" ]]; then
  echo "[error] expected 400 for CREATED next-round, got $STATUS"
  cat "$TMP_DIR/reject.json"
  exit 31
fi

# move to FEEDBACK_RETURNING (bind root then evaluate with pending)
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" \
  -H "content-type: application/json" \
  --data-binary '{"rootNodeId":"captain-A"}' >/dev/null
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/evaluate-closure" >/dev/null

# create next round with partial overrides
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/next-round" \
  -H "content-type: application/json" \
  --data-binary '{"issuerId":"sunwu-2","content":"下一轮新内容"}' \
  >"$TMP_DIR/next.json"

node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(!j.command?.commandId){throw new Error("new command id missing")}
if(j.command.commandId===process.argv[2]){throw new Error("new command id should differ")}
if(j.command.previousCommandId!==process.argv[2]){throw new Error("previousCommandId linkage missing")}
const inherited=j.inheritedFields||[];
if(!inherited.includes("targetNode") || !inherited.includes("executionRequirement") || !inherited.includes("feedbackRequirement")){
  throw new Error("inherited fields mismatch")
}
if(inherited.includes("content")){throw new Error("content should be overridden, not inherited")}
console.log("SMOKE PASS: next-round creation guard and inheritance markers are healthy.");
' "$TMP_DIR/next.json" "$COMMAND_ID"
