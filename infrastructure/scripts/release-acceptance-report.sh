#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

RUN_SCALABILITY_BASELINE="${RUN_SCALABILITY_BASELINE:-1}"
RUN_NODE_SCALE_1000="${RUN_NODE_SCALE_1000:-0}"
RUN_FULL_DRILL="${RUN_FULL_DRILL:-1}"

REPORT_DIR="$ROOT_DIR/docs/reports"
mkdir -p "$REPORT_DIR"
STAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
STAMP_FILE="$(date -u +"%Y%m%dT%H%M%SZ")"
REPORT_FILE="$REPORT_DIR/release-acceptance-$STAMP_FILE.md"
LATEST_REPORT="$ROOT_DIR/docs/release-acceptance-latest.md"
TMP_LOG="$(mktemp)"

cleanup() {
  rm -f "$TMP_LOG"
}
trap cleanup EXIT

echo "[start] release acceptance report generation"
echo "[info] RUN_FULL_DRILL=$RUN_FULL_DRILL RUN_SCALABILITY_BASELINE=$RUN_SCALABILITY_BASELINE RUN_NODE_SCALE_1000=$RUN_NODE_SCALE_1000"

FULL_DRILL_STATUS="SKIPPED"
if [[ "$RUN_FULL_DRILL" == "1" ]]; then
  if RUN_SCALABILITY_BASELINE="$RUN_SCALABILITY_BASELINE" RUN_NODE_SCALE_1000="$RUN_NODE_SCALE_1000" pnpm test:full-drill | tee "$TMP_LOG"; then
    FULL_DRILL_STATUS="PASS"
  else
    FULL_DRILL_STATUS="FAIL"
  fi
fi

if [[ "$FULL_DRILL_STATUS" == "FAIL" ]]; then
  echo "[error] full drill failed, report not generated"
  exit 91
fi

GIT_COMMIT="$(git rev-parse --short HEAD)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

SCALE_JSON_PATH="$ROOT_DIR/docs/scalability-baseline-latest.json"
SCALE_SUMMARY="not available"
if [[ -f "$SCALE_JSON_PATH" ]]; then
  SCALE_SUMMARY="$(node -e '
const fs=require("fs");
const p=process.argv[1];
const j=JSON.parse(fs.readFileSync(p,"utf8"));
console.log(`successRate=${j.successRate}, p95LatencyMs=${j.p95LatencyMs}, commandCount=${j.commandCount}, concurrency=${j.concurrency}`);
' "$SCALE_JSON_PATH")"
fi

EXTERNAL_JSON_PATH="$ROOT_DIR/docs/external-metrics-latest.json"
EXTERNAL_WEEKLY_PATH="$ROOT_DIR/docs/external-metrics-weekly-trend.md"
EXTERNAL_SUMMARY="not available"
EXTERNAL_WEEKLY_AVG="not available"
if [[ -f "$EXTERNAL_JSON_PATH" ]]; then
  EXTERNAL_SUMMARY="$(node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const api=(j.apiRequests.availabilityRate*100).toFixed(2);
const del=(j.callbackDeliveries.eventDeliverySuccessRate*100).toFixed(2);
const retry=(j.callbackDeliveries.retrySuccessRate*100).toFixed(2);
console.log(`window=${j.windowMinutes}min, apiAvailability=${api}%, deliverySuccess=${del}%, retrySuccess=${retry}%`);
' "$EXTERNAL_JSON_PATH")"
fi

if [[ -f "$EXTERNAL_WEEKLY_PATH" ]]; then
  EXTERNAL_WEEKLY_AVG="$(node -e '
const fs=require("fs");
const txt=fs.readFileSync(process.argv[1],"utf8");
const find=(re)=> (txt.match(re)?.[1] ?? "N/A");
const api=find(/API Availability Avg:\s*([0-9.]+%)/);
const del=find(/Delivery Success Avg:\s*([0-9.]+%)/);
const retry=find(/Retry Success Avg:\s*([0-9.]+%)/);
const count=find(/Snapshot count:\s*([0-9]+)/);
console.log(`snapshotCount=${count}, apiAvailabilityAvg=${api}, deliverySuccessAvg=${del}, retrySuccessAvg=${retry}`);
' "$EXTERNAL_WEEKLY_PATH")"
fi

{
  echo "# Release Acceptance Report"
  echo ""
  echo "- GeneratedAt(UTC): $STAMP_UTC"
  echo "- Branch: $GIT_BRANCH"
  echo "- Commit: $GIT_COMMIT"
  echo "- FullDrill: $FULL_DRILL_STATUS"
  echo "- RunScalabilityBaseline: $RUN_SCALABILITY_BASELINE"
  echo "- RunNodeScale1000: $RUN_NODE_SCALE_1000"
  echo ""
  echo "## KPI Snapshot"
  echo ""
  echo "- ScalabilityBaseline: $SCALE_SUMMARY"
  echo "- ExternalMetricsLatest: $EXTERNAL_SUMMARY"
  echo "- ExternalMetricsWeekly: $EXTERNAL_WEEKLY_AVG"
  echo ""
  echo "## Validation Evidence"
  echo ""
  if [[ -s "$TMP_LOG" ]]; then
    grep -E "SMOKE PASS|E2E PASS|DB PERSISTENCE REGRESSION PASS|FULL REGRESSION DRILL PASS|\\[skip\\]" "$TMP_LOG" || true
  else
    echo "- No full drill log captured (RUN_FULL_DRILL=0)"
  fi
  echo ""
  echo "## Artifacts"
  echo ""
  echo "- [scalability-baseline-latest.json](../scalability-baseline-latest.json)"
  echo "- [scalability-baseline-history.md](../scalability-baseline-history.md)"
  echo "- [external-metrics-latest.json](../external-metrics-latest.json)"
  echo "- [external-metrics-weekly-trend.md](../external-metrics-weekly-trend.md)"
} >"$REPORT_FILE"

cp "$REPORT_FILE" "$LATEST_REPORT"
echo "[report] generated=$REPORT_FILE"
echo "[report] latest=$LATEST_REPORT"
echo "RELEASE ACCEPTANCE REPORT PASS"
