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
  echo "[run] pnpm regression:db-persistence"
  pnpm regression:db-persistence
else
  echo "[skip] regression:db-persistence (set DATABASE_URL and PSQL_BIN to enable)"
fi

echo "FULL REGRESSION DRILL PASS"

