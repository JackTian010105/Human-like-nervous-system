#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

TESTS=(
  "test:core-command-flow"
  "test:understanding-idempotency"
  "test:propagation-idempotency"
  "test:timeout-recovery"
  "test:execution-feedback-idempotency"
  "test:feedback-aggregation-idempotency"
  "test:closure-state-machine"
  "test:next-round-creation"
  "test:audit-timeline-pagination"
  "test:node-ops-recovery"
  "e2e:external-integration"
)

echo "[start] running full regression drill (${#TESTS[@]} checks)"

for test_cmd in "${TESTS[@]}"; do
  echo "[run] pnpm ${test_cmd}"
  pnpm "${test_cmd}"
done

if [[ -n "${DATABASE_URL:-}" && -n "${PSQL_BIN:-}" ]]; then
  :
else
  if [[ -z "${PSQL_BIN:-}" ]]; then
    if [[ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]]; then
      export PSQL_BIN="/opt/homebrew/opt/postgresql@16/bin/psql"
    elif command -v psql >/dev/null 2>&1; then
      export PSQL_BIN="$(command -v psql)"
    fi
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    export DATABASE_URL="postgresql://${USER}@localhost:5432/command_neural"
  fi
fi

if [[ -n "${DATABASE_URL:-}" && -n "${PSQL_BIN:-}" ]] && "$PSQL_BIN" "$DATABASE_URL" -c 'select 1' >/dev/null 2>&1; then
  echo "[run] pnpm regression:db-persistence"
  pnpm regression:db-persistence
else
  echo "[skip] regression:db-persistence (unable to detect/connect postgres)"
fi

echo "FULL REGRESSION DRILL PASS"
