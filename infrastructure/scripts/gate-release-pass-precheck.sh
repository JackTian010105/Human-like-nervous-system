#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

REPORT_PATH="${REPORT_PATH:-$ROOT_DIR/docs/release-acceptance-latest.md}"
OUT_PATH="${OUT_PATH:-$ROOT_DIR/docs/release-gate-remediation-latest.md}"

if [[ ! -f "$REPORT_PATH" ]]; then
  echo "[error] report not found: $REPORT_PATH"
  echo "Run: pnpm report:release-acceptance"
  exit 93
fi

SCALE_LINE="$(rg -n "^- ScalabilityGate:" "$REPORT_PATH" -N | sed 's/^[[:space:]]*//')"
EXTERNAL_LINE="$(rg -n "^- ExternalMetricsGate:" "$REPORT_PATH" -N | sed 's/^[[:space:]]*//')"
FULL_LINE="$(rg -n "^- FullDrillGate:" "$REPORT_PATH" -N | sed 's/^[[:space:]]*//')"
OVERALL_LINE="$(rg -n "^- OverallDecision:" "$REPORT_PATH" -N | sed 's/^[[:space:]]*//')"

OVERALL_STATUS="$(echo "$OVERALL_LINE" | awk -F': ' '{print $2}')"
SCALE_STATUS="$(echo "$SCALE_LINE" | awk -F': ' '{print $2}' | awk '{print $1}')"
EXTERNAL_STATUS="$(echo "$EXTERNAL_LINE" | awk -F': ' '{print $2}' | awk '{print $1}')"
FULL_STATUS="$(echo "$FULL_LINE" | awk -F': ' '{print $2}')"

STAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

{
  echo "# Release Gate Remediation Checklist"
  echo ""
  echo "- GeneratedAt(UTC): $STAMP_UTC"
  echo "- SourceReport: $REPORT_PATH"
  echo "- OverallDecision: ${OVERALL_STATUS:-UNKNOWN}"
  echo ""
  echo "## Current Gate Status"
  echo ""
  echo "- ${SCALE_LINE:-- ScalabilityGate: N/A}"
  echo "- ${EXTERNAL_LINE:-- ExternalMetricsGate: N/A}"
  echo "- ${FULL_LINE:-- FullDrillGate: N/A}"
  echo ""
  echo "## Actions To Reach PASS"
  echo ""

  if [[ "$FULL_STATUS" != "PASS" ]]; then
    echo "1. Run strict gate once to get full evidence:"
    echo "   - \`pnpm gate:release:strict\`"
  fi

  if [[ "$SCALE_STATUS" != "PASS" ]]; then
    echo "1. Fix scalability gate:"
    echo "   - Re-run \`pnpm test:scalability-baseline\` and check successRate/p95 targets"
    echo "   - If failing, reduce latency hotspots in draft/issue/root-node path"
  fi

  if [[ "$EXTERNAL_STATUS" != "PASS" ]]; then
    echo "1. Fix external metrics gate (usually the blocker):"
    echo "   - Increase callback success and retry success by replacing fail endpoints in callback subscriptions"
    echo "   - Validate via \`pnpm test:external-metrics-export\`"
    echo "   - Refresh snapshot via \`pnpm report:external-metrics-snapshot\`"
    echo "   - Re-generate release report via \`pnpm report:release-acceptance\`"
  fi

  if [[ "$FULL_STATUS" == "PASS" && "$SCALE_STATUS" == "PASS" && "$EXTERNAL_STATUS" == "PASS" ]]; then
    echo "1. No blocking items found. Gate is ready for PASS."
  fi

  echo ""
  echo "## Quick Path"
  echo ""
  echo "1. \`pnpm report:external-metrics-snapshot\`"
  echo "2. \`pnpm gate:release:strict\`"
  echo "3. If still WARN, follow action list above and repeat."
} >"$OUT_PATH"

echo "[report] remediation=$OUT_PATH"
echo "RELEASE GATE PRECHECK PASS"

