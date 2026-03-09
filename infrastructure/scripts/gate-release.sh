#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-${GATE_RELEASE_MODE:-fast}}"
RUN_FULL_DRILL="${RUN_FULL_DRILL:-0}"
RUN_SCALABILITY_BASELINE="${RUN_SCALABILITY_BASELINE:-1}"
RUN_NODE_SCALE_1000="${RUN_NODE_SCALE_1000:-0}"

case "$MODE" in
  fast)
    RUN_FULL_DRILL=0
    ;;
  strict)
    RUN_FULL_DRILL=1
    ;;
  *)
    echo "[gate] invalid mode: $MODE (expected: fast|strict)"
    exit 2
    ;;
esac

echo "[gate] release gate start"
echo "[gate] MODE=$MODE RUN_FULL_DRILL=$RUN_FULL_DRILL RUN_SCALABILITY_BASELINE=$RUN_SCALABILITY_BASELINE RUN_NODE_SCALE_1000=$RUN_NODE_SCALE_1000"

RELEASE_GATE_ENFORCE=1 \
RUN_FULL_DRILL="$RUN_FULL_DRILL" \
RUN_SCALABILITY_BASELINE="$RUN_SCALABILITY_BASELINE" \
RUN_NODE_SCALE_1000="$RUN_NODE_SCALE_1000" \
pnpm report:release-acceptance

echo "[gate] release gate passed"
