# Staging Go-Live Execution Record

Project: `Command Neural System`  
Environment: `local-staging-rehearsal`  
Execution Date: `2026-03-08`  
Release Version/Commit: `3bf5c40`  
Coordinator: `Codex`

## Checklist Execution

| # | Item | Owner | Time (UTC+8) | Result (Pass/Fail) | Evidence |
|---|------|-------|--------------|--------------------|----------|
| 1 | `DATABASE_URL` / `EXTERNAL_API_TOKEN` verified | Codex | 23:04 | Pass (Rehearsal) | Drill used `DATABASE_URL=postgresql://jack@localhost:5432/command_neural`; `EXTERNAL_API_TOKEN=staging-token-001` (non-default). |
| 2 | DB account privileges verified | Codex | 23:12 | Pass (After Remediation) | `current_user=command_app`, `is_superuser=false`, `can_connect=true`, `can_create=false` (DB-level). |
| 3 | Startup log + `/health` verified | Codex | 23:01 | Pass | Log contains `PostgreSQL persistence enabled`; `/health` => `{\"status\":\"ok\"}`. |
| 4 | `pnpm e2e:external-integration` pass | Codex | 22:59 | Pass | Script output: `E2E PASS: external integration flow is healthy.` |
| 5 | `pnpm regression:db-persistence` pass | Codex | 23:00 | Pass | Script output: `DB PERSISTENCE REGRESSION PASS`; restart rehydration assertions passed. |
| 6 | Callback signature validation pass | Codex | 23:04 | Pass | `verify:callback-signature` returned `{ \"valid\": true }`. |
| 7 | Idempotency replay returns same `CommandID` | Codex | 23:04 | Pass | Replay test: `CID1=CMD-62b2228b-...` and `CID2=CMD-62b2228b-...` identical. |
| 8 | Failure retry semantics (`attempts=3`) verified | Codex | 23:04 | Pass | Deliveries summary: `failedAttempts=3`, `failedStatus=FAILED`, `lastError=callback_delivery_failed_after_3_retries`. |
| 9 | Restart rehydration verified | Codex | 23:00 | Pass | Regression script restart step confirms `/commands` and `/commands/alerts/timeouts` rehydrated. |
| 10 | Rollback runbook verified | Codex | 23:15 | Pass (After Remediation) | Runbook: `docs/staging-rollback-runbook.md`; evidence: `docs/staging-rollback-evidence-2026-03-08.md`. |

## Blocking Issues

| Severity | Description | Owner | Mitigation | Status |
|----------|-------------|-------|------------|--------|
| High | None | - | - | Closed |

## Final Decision

- Go/No-Go: `GO`
- Approved By: `jack`
- Approval Time: `2026-03-09 03:00`
- Notes:
  - Functional flow is healthy in rehearsal (health, idempotency, callback signature, retry semantics, persistence regression).
  - Least-privilege remediation completed locally: created `command_app`, granted required privileges, transferred existing table ownership to app role so startup schema/index checks pass, and verified `PostgreSQL persistence enabled`.
  - Rollback evidence completed in `docs/staging-rollback-evidence-2026-03-08.md`.
  - Final verification on March 9, 2026: `/health` ok, `e2e:external-integration` PASS, `regression:db-persistence` PASS.
