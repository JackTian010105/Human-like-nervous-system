#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

MODE=nightly WINDOW_MINUTES="${WINDOW_MINUTES:-10080}" bash infrastructure/scripts/gate-release-auto-remediation-drill.sh

