# Release Acceptance Report

- GeneratedAt(UTC): 2026-03-09T07:31:18Z
- Branch: main
- Commit: f49e17f
- FullDrill: PASS
- RunScalabilityBaseline: 1
- RunNodeScale1000: 0
- ReleaseGateEnforce: 1
- OverallDecision: PASS

## KPI Snapshot

- ScalabilityBaseline: successRate=1, p95LatencyMs=28.059, commandCount=100, concurrency=20
- ExternalMetricsLatest: window=10080min, apiAvailability=100.00%, deliverySuccess=100.00%, retrySuccess=100.00%
- ExternalMetricsWeekly: snapshotCount=4, apiAvailabilityAvg=93.75%, deliverySuccessAvg=90.00%, retrySuccessAvg=75.00%

## Threshold Gates

- ScalabilityGate: PASS (successRate=1 (target>=0.99), p95LatencyMs=28.059 (target<=5000))
- ExternalMetricsGate: PASS (apiAvailability=1 (target>=0.995), deliverySuccess=1 (target>=0.999), retrySuccess=1 (target>=0.99))
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
