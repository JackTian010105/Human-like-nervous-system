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
```
