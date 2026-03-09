# Release Acceptance Report

- GeneratedAt(UTC): 2026-03-09T02:28:01Z
- Branch: main
- Commit: f753d7f
- FullDrill: SKIPPED
- RunScalabilityBaseline: 1
- RunNodeScale1000: 0
- ReleaseGateEnforce: 0
- OverallDecision: WARN

## KPI Snapshot

- ScalabilityBaseline: successRate=1, p95LatencyMs=32.015, commandCount=100, concurrency=20
- ExternalMetricsLatest: window=30min, apiAvailability=100.00%, deliverySuccess=100.00%, retrySuccess=100.00%
- ExternalMetricsWeekly: snapshotCount=2, apiAvailabilityAvg=87.50%, deliverySuccessAvg=80.00%, retrySuccessAvg=50.00%

## Threshold Gates

- ScalabilityGate: PASS (successRate=1 (target>=0.99), p95LatencyMs=32.015 (target<=5000))
- ExternalMetricsGate: PASS (apiAvailability=1 (target>=0.995), deliverySuccess=1 (target>=0.999), retrySuccess=1 (target>=0.99))
- FullDrillGate: SKIPPED

## Validation Evidence

- No full drill log captured (RUN_FULL_DRILL=0)

## Artifacts

- [scalability-baseline-latest.json](../scalability-baseline-latest.json)
- [scalability-baseline-history.md](../scalability-baseline-history.md)
- [external-metrics-latest.json](../external-metrics-latest.json)
- [external-metrics-weekly-trend.md](../external-metrics-weekly-trend.md)
