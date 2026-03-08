#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3101}"
API_BASE="http://localhost:${API_PORT}"
DATABASE_URL="${DATABASE_URL:-postgresql://jack@localhost:5432/command_neural}"
PSQL_BIN="${PSQL_BIN:-psql}"
IDEMP_KEY="persist-$(date +%s)"

cleanup() {
  if [[ -f /tmp/command-api-reg.pid ]]; then
    kill "$(cat /tmp/command-api-reg.pid)" 2>/dev/null || true
    wait "$(cat /tmp/command-api-reg.pid)" 2>/dev/null || true
    rm -f /tmp/command-api-reg.pid
  fi
}
trap cleanup EXIT

if ! command -v "$PSQL_BIN" >/dev/null 2>&1; then
  echo "[error] psql binary not found: $PSQL_BIN"
  exit 2
fi

if [[ ! -f "apps/command-api/dist/main.js" ]]; then
  echo "[setup] command-api dist missing, building..."
  pnpm --filter command-api build >/dev/null
fi

echo "[start] API on :$API_PORT"
PORT="$API_PORT" DATABASE_URL="$DATABASE_URL" node apps/command-api/dist/main.js >/tmp/command-api-reg.log 2>&1 &
echo $! >/tmp/command-api-reg.pid

for _ in $(seq 1 30); do
  if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "$API_BASE/health" >/dev/null

echo "[step] truncate tables"
"$PSQL_BIN" "$DATABASE_URL" -c "truncate table callback_deliveries, audit_events, node_deliveries, timeout_alerts, commands, command_drafts, external_callback_subscriptions, external_idempotency_keys restart identity;"

echo "[step] write scenarios"
curl -fsS -X POST "$API_BASE/api/external/callbacks/register" \
  -H "content-type: application/json" \
  -H "x-external-token: dev-external-token" \
  --data-binary '{"externalSystemId":"mozi-system","callbackUrl":"https://partner.example/fail-callback","signingSecret":"secret-123"}' >/tmp/reg-cb.json

curl -fsS -X POST "$API_BASE/commands/drafts" \
  -H "content-type: application/json" \
  -d '{"content":"保持队列","targetNode":"队长A","executionRequirement":"立即","feedbackRequirement":"30秒"}' >/tmp/reg-draft.json

DRAFT_ID="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('/tmp/reg-draft.json','utf8')).draft.draftId)")"
curl -fsS -X POST "$API_BASE/commands/drafts/$DRAFT_ID/issue" \
  -H "content-type: application/json" \
  -d '{"issuerId":"sunwu"}' >/tmp/reg-cmd.json

CMD_ID="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('/tmp/reg-cmd.json','utf8')).command.commandId)")"
curl -fsS -X POST "$API_BASE/commands/$CMD_ID/root-node" \
  -H "content-type: application/json" \
  -d '{"rootNodeId":"captain-A"}' >/tmp/reg-bind.json

sleep 6
curl -fsS -X POST "$API_BASE/commands/monitor/timeouts/scan" >/tmp/reg-scan.json

curl -fsS -X POST "$API_BASE/api/external/commands" \
  -H "content-type: application/json" \
  -H "x-external-token: dev-external-token" \
  -H "idempotency-key: $IDEMP_KEY" \
  --data-binary '{"externalSystemId":"mozi-system","content":"外部发令","targetNode":"captain-A","executionRequirement":"now","feedbackRequirement":"soon"}' >/tmp/reg-ext1.json

curl -fsS -X POST "$API_BASE/api/external/commands" \
  -H "content-type: application/json" \
  -H "x-external-token: dev-external-token" \
  -H "idempotency-key: $IDEMP_KEY" \
  --data-binary '{"externalSystemId":"mozi-system","content":"外部发令","targetNode":"captain-A","executionRequirement":"now","feedbackRequirement":"soon"}' >/tmp/reg-ext2.json

echo "[step] assert db counts"
COUNTS="$("$PSQL_BIN" "$DATABASE_URL" -Atc "select 'command_drafts='||count(*) from command_drafts union all select 'commands='||count(*) from commands union all select 'audit_events='||count(*) from audit_events union all select 'callback_deliveries='||count(*) from callback_deliveries union all select 'node_deliveries='||count(*) from node_deliveries union all select 'timeout_alerts='||count(*) from timeout_alerts union all select 'callback_subscriptions='||count(*) from external_callback_subscriptions union all select 'external_idempotency_keys='||count(*) from external_idempotency_keys;")"
echo "$COUNTS"
for key in command_drafts commands audit_events callback_deliveries node_deliveries timeout_alerts callback_subscriptions external_idempotency_keys; do
  value="$(echo "$COUNTS" | sed -n "s/^${key}=//p" | head -n1)"
  if [[ -z "$value" || "$value" -lt 1 ]]; then
    echo "[error] expected ${key} >= 1, got '${value:-missing}'"
    exit 3
  fi
done

echo "[step] restart and rehydrate assertions"
kill "$(cat /tmp/command-api-reg.pid)" || true
wait "$(cat /tmp/command-api-reg.pid)" 2>/dev/null || true

PORT="$API_PORT" DATABASE_URL="$DATABASE_URL" node apps/command-api/dist/main.js >/tmp/command-api-reg.log 2>&1 &
echo $! >/tmp/command-api-reg.pid
sleep 2

REHYDRATED_COMMANDS="$(curl -fsS "$API_BASE/commands")"
REHYDRATED_ALERTS="$(curl -fsS "$API_BASE/commands/alerts/timeouts")"
echo "$REHYDRATED_COMMANDS" | head -c 220; echo
echo "$REHYDRATED_ALERTS" | head -c 220; echo

echo "$REHYDRATED_COMMANDS" | grep -q '"commandId"' || { echo "[error] no commands after restart"; exit 4; }
echo "$REHYDRATED_ALERTS" | grep -q '"timeoutType"' || { echo "[error] no timeout alerts after restart"; exit 5; }

echo ""
echo "DB PERSISTENCE REGRESSION PASS"
