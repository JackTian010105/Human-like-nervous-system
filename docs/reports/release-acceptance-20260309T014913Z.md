# Release Acceptance Report

- GeneratedAt(UTC): 2026-03-09T01:49:13Z
- Branch: main
- Commit: e78c79b
- FullDrill: SKIPPED
- RunScalabilityBaseline: 1
- RunNodeScale1000: 0
- ReleaseGateEnforce: 0
- OverallDecision: WARN

## KPI Snapshot

- ScalabilityBaseline: successRate=1, p95LatencyMs=32.817, commandCount=100, concurrency=20
- ExternalMetricsLatest: window=10080min, apiAvailability=75.00%, deliverySuccess=60.00%, retrySuccess=0.00%
- ExternalMetricsWeekly: snapshotCount=1, apiAvailabilityAvg=75.00%, deliverySuccessAvg=60.00%, retrySuccessAvg=0.00%

## Threshold Gates

- ScalabilityGate: PASS (successRate=1 (target>=0.99), p95LatencyMs=32.817 (target<=5000))
- ExternalMetricsGate: WARN (apiAvailability=0.75 (target>=0.995), deliverySuccess=0.6 (target>=0.999), retrySuccess=0 (target>=0.99))
- FullDrillGate: SKIPPED

## Validation Evidence

- No full drill log captured (RUN_FULL_DRILL=0)

## Artifacts

- [scalability-baseline-latest.json](../scalability-baseline-latest.json)
- [scalability-baseline-history.md](../scalability-baseline-history.md)
- [external-metrics-latest.json](../external-metrics-latest.json)
- [external-metrics-weekly-trend.md](../external-metrics-weekly-trend.md)
