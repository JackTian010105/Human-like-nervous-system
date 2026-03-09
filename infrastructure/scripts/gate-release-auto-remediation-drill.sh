#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

MODE="${MODE:-standard}" # standard | nightly
WINDOW_MINUTES="${WINDOW_MINUTES:-}"
TMP_DIR="$(mktemp -d)"
BASELINE_REPORT="$TMP_DIR/baseline-report.md"
PASS_REPORT="$TMP_DIR/pass-report.md"
OUT="$ROOT_DIR/docs/release-gate-auto-remediation-drill-latest.md"
HISTORY_MD="$ROOT_DIR/docs/release-gate-auto-remediation-history.md"
REPORT_DIR="$ROOT_DIR/docs/reports"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

extract_overall() {
  local file="$1"
  grep -E "^- OverallDecision:" "$file" | awk -F': ' '{print $2}' | tail -n 1
}

if [[ "$MODE" == "nightly" ]]; then
  WINDOW_MINUTES="${WINDOW_MINUTES:-10080}"
else
  WINDOW_MINUTES="${WINDOW_MINUTES:-30}"
fi

mkdir -p "$REPORT_DIR"

echo "[drill] capture baseline decision (non-enforcing)"
RELEASE_GATE_ENFORCE=0 RUN_FULL_DRILL=0 pnpm report:release-acceptance >/dev/null
cp "$ROOT_DIR/docs/release-acceptance-latest.md" "$BASELINE_REPORT"
BASELINE_DECISION="$(extract_overall "$BASELINE_REPORT")"

echo "[drill] build PASS-oriented external metrics snapshot"
WINDOW_MINUTES="$WINDOW_MINUTES" SEED_SAMPLE=1 SEED_PROFILE=pass pnpm report:external-metrics-snapshot >/dev/null

echo "[drill] run strict gate with enforced blocking"
STRICT_EXIT=0
if ! pnpm gate:release:strict >/dev/null 2>&1; then
  STRICT_EXIT=$?
fi

echo "[drill] capture post-run decision"
cp "$ROOT_DIR/docs/release-acceptance-latest.md" "$PASS_REPORT"
POST_DECISION="$(extract_overall "$PASS_REPORT")"

STAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
STAMP_FILE="$(date -u +"%Y%m%dT%H%M%SZ")"
NIGHTLY_OUT="$REPORT_DIR/release-gate-auto-remediation-$STAMP_FILE.md"
{
  echo "# Release Gate Auto-Remediation Drill"
  echo ""
  echo "- GeneratedAt(UTC): $STAMP_UTC"
  echo "- Mode: $MODE"
  echo "- BaselineDecision: ${BASELINE_DECISION:-UNKNOWN}"
  echo "- PostDecision: ${POST_DECISION:-UNKNOWN}"
  echo "- StrictGateExitCode: $STRICT_EXIT"
  echo "- SnapshotWindowMinutes: $WINDOW_MINUTES"
  echo ""
  echo "## Outcome"
  echo ""
  if [[ "$BASELINE_DECISION" != "PASS" && "$POST_DECISION" == "PASS" && "$STRICT_EXIT" -eq 0 ]]; then
    echo "- Status: PASS"
    echo "- Result: gate improved from WARN/FAIL to PASS."
  else
    echo "- Status: WARN"
    echo "- Result: gate did not converge to PASS in this drill."
  fi
  echo ""
  echo "## Notes"
  echo ""
  echo "- This drill is for test/staging remediation rehearsal."
  echo "- It uses PASS-profile snapshot seeding to validate gate transition mechanics."
} >"$OUT"

if [[ "$MODE" == "nightly" ]]; then
  cp "$OUT" "$NIGHTLY_OUT"
  if [[ ! -f "$HISTORY_MD" ]]; then
    cat >"$HISTORY_MD" <<'MD'
# Release Gate Auto-Remediation History

| Timestamp (UTC) | Baseline | Post | StrictExit | Status |
| --- | --- | --- | ---: | --- |
MD
  fi
  STATUS="WARN"
  if [[ "$BASELINE_DECISION" != "PASS" && "$POST_DECISION" == "PASS" && "$STRICT_EXIT" -eq 0 ]]; then
    STATUS="PASS"
  fi
  printf '| %s | %s | %s | %s | %s |\n' "$STAMP_UTC" "${BASELINE_DECISION:-UNKNOWN}" "${POST_DECISION:-UNKNOWN}" "$STRICT_EXIT" "$STATUS" >>"$HISTORY_MD"
fi

echo "[report] drill=$OUT"
if [[ "$MODE" == "nightly" ]]; then
  echo "[report] nightly=$NIGHTLY_OUT"
  echo "[report] history=$HISTORY_MD"
fi
if [[ "$BASELINE_DECISION" != "PASS" && "$POST_DECISION" == "PASS" && "$STRICT_EXIT" -eq 0 ]]; then
  echo "AUTO REMEDIATION DRILL PASS"
  exit 0
fi

echo "AUTO REMEDIATION DRILL WARN"
exit 95
