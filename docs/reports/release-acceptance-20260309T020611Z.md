# Release Acceptance Report

- GeneratedAt(UTC): 2026-03-09T02:06:11Z
- Branch: main
- Commit: a2e5cc0
- FullDrill: PASS
- RunScalabilityBaseline: 1
- RunNodeScale1000: 0
- ReleaseGateEnforce: 1
- OverallDecision: WARN

## KPI Snapshot

- ScalabilityBaseline: successRate=1, p95LatencyMs=30.883, commandCount=100, concurrency=20
- ExternalMetricsLatest: window=10080min, apiAvailability=75.00%, deliverySuccess=60.00%, retrySuccess=0.00%
- ExternalMetricsWeekly: snapshotCount=1, apiAvailabilityAvg=75.00%, deliverySuccessAvg=60.00%, retrySuccessAvg=0.00%

## Threshold Gates

- ScalabilityGate: PASS (successRate=1 (target>=0.99), p95LatencyMs=30.883 (target<=5000))
- ExternalMetricsGate: WARN (apiAvailability=0.75 (target>=0.995), deliverySuccess=0.6 (target>=0.999), retrySuccess=0 (target>=0.99))
- FullDrillGate: PASS

## Validation Evidence

SMOKE PASS: core command flow is healthy.
SMOKE PASS: understanding receipt idempotency is healthy.
SMOKE PASS: propagation idempotency is healthy.
SMOKE PASS: timeout recovery event chain is healthy.
SMOKE PASS: execution feedback idempotency is healthy.
SMOKE PASS: feedback aggregation idempotency is healthy.
SMOKE PASS: closure state-machine guard and close path are healthy.
SMOKE PASS: next-round creation guard and inheritance markers are healthy.
SMOKE PASS: audit timeline pagination is healthy.
SMOKE PASS: node ops config/diagnostics/recovery flow is healthy.
SMOKE PASS: external metrics export is healthy.
E2E PASS: external integration flow is healthy.
SMOKE PASS: scalability baseline is healthy.
[skip] node scale 1000 (set RUN_NODE_SCALE_1000=1 to enable)
DB PERSISTENCE REGRESSION PASS
FULL REGRESSION DRILL PASS

## Artifacts

- [scalability-baseline-latest.json](../scalability-baseline-latest.json)
- [scalability-baseline-history.md](../scalability-baseline-history.md)
- [external-metrics-latest.json](../external-metrics-latest.json)
- [external-metrics-weekly-trend.md](../external-metrics-weekly-trend.md)
