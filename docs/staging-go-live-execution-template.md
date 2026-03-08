# Staging Go-Live Execution Record (Template)

Project: `Command Neural System`  
Environment: `staging`  
Execution Date: `YYYY-MM-DD`  
Release Version/Commit: `<commit-sha>`  
Coordinator: `<name>`

## Checklist Execution

| # | Item | Owner | Time (UTC+8) | Result (Pass/Fail) | Evidence |
|---|------|-------|--------------|--------------------|----------|
| 1 | `DATABASE_URL` / `EXTERNAL_API_TOKEN` verified |  |  |  |  |
| 2 | DB account privileges verified |  |  |  |  |
| 3 | Startup log + `/health` verified |  |  |  |  |
| 4 | `pnpm e2e:external-integration` pass |  |  |  |  |
| 5 | `pnpm regression:db-persistence` pass |  |  |  |  |
| 6 | Callback signature validation pass |  |  |  |  |
| 7 | Idempotency replay returns same `CommandID` |  |  |  |  |
| 8 | Failure retry semantics (`attempts=3`) verified |  |  |  |  |
| 9 | Restart rehydration verified |  |  |  |  |
| 10 | Rollback runbook verified |  |  |  |  |

## Blocking Issues

| Severity | Description | Owner | Mitigation | Status |
|----------|-------------|-------|------------|--------|
|          |             |       |            |        |

## Final Decision

- Go/No-Go: `<GO | NO-GO>`
- Approved By: `<name>`
- Approval Time: `YYYY-MM-DD HH:mm`
- Notes:
  - `<note 1>`
  - `<note 2>`
