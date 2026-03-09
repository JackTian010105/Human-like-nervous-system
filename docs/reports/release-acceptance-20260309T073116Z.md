# Release Acceptance Report

- GeneratedAt(UTC): 2026-03-09T07:31:16Z
- Branch: main
- Commit: f49e17f
- FullDrill: SKIPPED
- RunScalabilityBaseline: 1
- RunNodeScale1000: 0
- ReleaseGateEnforce: 0
- OverallDecision: WARN

## KPI Snapshot

- ScalabilityBaseline: successRate=1, p95LatencyMs=28.828, commandCount=100, concurrency=20
- ExternalMetricsLatest: window=10080min, apiAvailability=100.00%, deliverySuccess=100.00%, retrySuccess=100.00%
- ExternalMetricsWeekly: snapshotCount=3, apiAvailabilityAvg=91.67%, deliverySuccessAvg=86.67%, retrySuccessAvg=66.67%

## Threshold Gates

- ScalabilityGate: PASS (successRate=1 (target>=0.99), p95LatencyMs=28.828 (target<=5000))
- ExternalMetricsGate: PASS (apiAvailability=1 (target>=0.995), deliverySuccess=1 (target>=0.999), retrySuccess=1 (target>=0.99))
- FullDrillGate: SKIPPED

## Validation Evidence

- No full drill log captured (RUN_FULL_DRILL=0)

## Artifacts

- [scalability-baseline-latest.json](../scalability-baseline-latest.json)
- [scalability-baseline-history.md](../scalability-baseline-history.md)
- [external-metrics-latest.json](../external-metrics-latest.json)
- [external-metrics-weekly-trend.md](../external-metrics-weekly-trend.md)
