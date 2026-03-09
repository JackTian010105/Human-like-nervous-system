# Release Gate Remediation Checklist

- GeneratedAt(UTC): 2026-03-09T02:16:49Z
- SourceReport: /Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/docs/release-acceptance-latest.md
- OverallDecision: WARN

## Current Gate Status

- - ScalabilityGate: PASS (successRate=1 (target>=0.99), p95LatencyMs=29.036 (target<=5000))
- - ExternalMetricsGate: WARN (apiAvailability=0.75 (target>=0.995), deliverySuccess=0.6 (target>=0.999), retrySuccess=0 (target>=0.99))
- - FullDrillGate: PASS

## Actions To Reach PASS

1. Fix external metrics gate (usually the blocker):
   - Increase callback success and retry success by replacing fail endpoints in callback subscriptions
   - Validate via `pnpm test:external-metrics-export`
   - Refresh snapshot via `pnpm report:external-metrics-snapshot`
   - Re-generate release report via `pnpm report:release-acceptance`

## Quick Path

1. `pnpm report:external-metrics-snapshot`
2. `pnpm gate:release:strict`
3. If still WARN, follow action list above and repeat.
