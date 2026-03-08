# Staging Rollback Evidence (2026-03-08)

Project: `Command Neural System`  
Environment: `local-staging-rehearsal`  
Owner: `Release Owner (Codex on behalf of team)`  
Recorded At (UTC+8): `2026-03-08 23:15`

## 1) Previous Stable Build Artifact

- Stable commit/tag reference: `3bf5c40`
- Source reference: `git rev-parse --short HEAD` at execution time
- Backend runnable artifact path: `apps/command-api/dist/main.js`
- Frontend runnable artifact path: `apps/console-web/.next` (when built)

## 2) Rollback Runbook Availability

- Runbook: [staging-rollback-runbook.md](/Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/docs/staging-rollback-runbook.md)
- Scope covered:
  - app rollback
  - config rollback
  - data rollback boundary
  - verification checklist
  - communication template

## 3) Dry-Run Record

- Dry-run type: local rehearsal (non-destructive)
- Validation points:
  - `/health` reachable after app restart
  - API key auth rejection (`401`) still effective
  - DB persistence startup log available under non-superuser app role
- Result: `PASS`

