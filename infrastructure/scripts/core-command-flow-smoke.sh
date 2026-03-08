#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3201}"
API_BASE="http://localhost:${API_PORT}"
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

for _ in $(seq 1 30); do
  if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[step] health"
if ! curl -fsS "$API_BASE/health" >/dev/null; then
  echo "[error] api health check failed"
  echo "--- command-api log tail ---"
  tail -n 80 "$API_LOG" || true
  exit 10
fi

echo "[step] create draft"
curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  --data-binary '{"content":"全队整齐","targetNode":"队长A","executionRequirement":"10秒内","feedbackRequirement":"30秒回执"}' \
  >"$TMP_DIR/draft.json"

DRAFT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).draft.draftId)" "$TMP_DIR/draft.json")"
if [[ -z "$DRAFT_ID" ]]; then
  echo "[error] draftId missing"
  exit 11
fi

echo "[step] issue command"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: smoke:$DRAFT_ID" \
  --data-binary '{"issuerId":"sunwu"}' \
  >"$TMP_DIR/issue.json"

COMMAND_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.commandId)" "$TMP_DIR/issue.json")"
STATUS_ISSUED="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.status)" "$TMP_DIR/issue.json")"
if [[ -z "$COMMAND_ID" ]]; then
  echo "[error] commandId missing"
  exit 12
fi
if [[ "$STATUS_ISSUED" != "CREATED" ]]; then
  echo "[error] unexpected issued status: $STATUS_ISSUED"
  exit 13
fi

echo "[step] bind root node"
curl -fsS -X POST "$API_BASE/commands/$COMMAND_ID/root-node" \
  -H "content-type: application/json" \
  --data-binary '{"rootNodeId":"captain-A"}' \
  >"$TMP_DIR/bind.json"

ROOT_NODE="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.rootNodeId)" "$TMP_DIR/bind.json")"
STATUS_BOUND="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).command.status)" "$TMP_DIR/bind.json")"
if [[ "$ROOT_NODE" != "captain-A" ]]; then
  echo "[error] unexpected root node: $ROOT_NODE"
  exit 14
fi
if [[ "$STATUS_BOUND" != "DISPATCHED_PENDING_RECEIVE" ]]; then
  echo "[error] unexpected bound status: $STATUS_BOUND"
  exit 15
fi

echo "[step] verify command list visibility"
curl -fsS "$API_BASE/commands" >"$TMP_DIR/list.json"
node -e '
const fs=require("fs");
const file=process.argv[1];
const cmd=process.argv[2];
const list=JSON.parse(fs.readFileSync(file,"utf8")).commands;
if(!Array.isArray(list)){throw new Error("commands response invalid")}
if(!list.some((item)=>item.commandId===cmd)){throw new Error("issued command not visible in list")}
console.log("[assert] issued command visible");
' "$TMP_DIR/list.json" "$COMMAND_ID"

echo ""
echo "SMOKE PASS: core command flow is healthy."
