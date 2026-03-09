# Command Neural System (Starter)

Story 1.1 starter monorepo for `process_control` project.

## Current Goal

Set up a minimal runnable foundation with Next.js (console) + NestJS (API) + shared packages.

## What This Stage Includes

- Monorepo workspace with pnpm
- `apps/console-web` (Next.js + TypeScript)
- `apps/command-api` (NestJS + TypeScript)
- `packages/shared-types` (shared TypeScript types)
- `packages/shared-config` (shared lint/tsconfig/prettier config)
- Placeholder docker compose for PostgreSQL + Redis

## What This Stage Does NOT Include

- No Command/Node/Event business entities
- No ORM/database business integration
- No Redis business integration
- No auth/RBAC
- No WebSocket/SSE
- No state machine
- No audit logic
- No external API integrations

## Directory Layout

```text
apps/
  console-web/
  command-api/
packages/
  shared-types/
  shared-config/
infrastructure/
  docker/
  scripts/
```

## Quick Start

1. Install dependencies

```bash
pnpm install
```

2. Start both apps

```bash
pnpm dev
```

3. Verify

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/health`

## Workspace Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm verify:callback-signature /tmp/payload.json <signature-hex> <secret>
pnpm test:node-scale-1000
pnpm test:scalability-baseline
pnpm test:external-metrics-export
pnpm test:full-drill
pnpm report:release-acceptance
pnpm report:external-metrics-snapshot
pnpm gate:release
pnpm e2e:external-integration
pnpm regression:db-persistence
```

Optional full-drill flags:

- `RUN_SCALABILITY_BASELINE=1 pnpm test:full-drill`
- `RUN_NODE_SCALE_1000=1 pnpm test:full-drill`
- `RUN_FULL_DRILL=0 pnpm report:release-acceptance` (only generate report from existing artifacts)
- `WINDOW_MINUTES=10080 SEED_SAMPLE=1 pnpm report:external-metrics-snapshot`
- `RELEASE_GATE_ENFORCE=1 pnpm report:release-acceptance` (default, WARN blocks with exit code 92)
- `RELEASE_GATE_ENFORCE=0 pnpm report:release-acceptance` (generate report only, no block)
- `pnpm gate:release` (CI-oriented command, always enforces gate)

Signature verification guide: `docs/external-callback-signature.md`
Partner onboarding SOP: `docs/external-integration-sop.md`
Staging checklist: `docs/staging-go-live-checklist.md`
Staging execution template: `docs/staging-go-live-execution-template.md`
Staging rollback runbook: `docs/staging-rollback-runbook.md`
Staging rollback evidence (sample): `docs/staging-rollback-evidence-2026-03-08.md`
PostgreSQL least-privilege SQL: `infrastructure/scripts/postgres-least-privilege.sql`
