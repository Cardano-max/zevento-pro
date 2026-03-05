---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nestjs, prisma, postgres, redis, pnpm, turborepo, docker, typescript, monorepo]

# Dependency graph
requires: []
provides:
  - pnpm workspace monorepo with apps/*, packages/*, api structure
  - Docker Compose with Postgres 16-alpine and Redis 7-alpine on localhost
  - NestJS API on port 3001 with health check endpoint
  - Prisma schema: users, user_roles, markets, consent_logs, webhook_events tables
  - packages/shared with Role, MarketStatus, ConsentType, ConsentStatus, WebhookEventStatus enums
  - GlobalValidationPipe with class-validator configured on API
affects:
  - 01-02 (auth — uses PrismaService, User model, UserRole model, Redis for OTP)
  - 01-03 (privacy consent — uses ConsentLog model, PrismaService)
  - all downstream phases (API foundation, shared types)

# Tech tracking
tech-stack:
  added:
    - turbo 2.8.13 (monorepo task runner)
    - typescript 5.9.3 (type safety)
    - nestjs/common, nestjs/core, nestjs/platform-express 10.x (API framework)
    - @prisma/client 6.19.2 + prisma 6.19.2 (ORM + schema management)
    - class-validator 0.15.1 + class-transformer 0.5.1 (DTO validation)
    - ioredis 5.x (Redis client for future auth/queue use)
    - rxjs 7.x (NestJS dependency)
    - postgres:16-alpine + redis:7-alpine (local Docker images)
  patterns:
    - Global PrismaModule injected via @Global() decorator — no per-module imports needed
    - NestJS health check at GET / returning {status, timestamp, service, version}
    - Snake_case DB columns via @@map on all models, uuid @default for all PKs
    - user_roles as separate table (not role column on users) — enables multi-role identity
    - markets as first-class entity (not city string) — enables city expansion without migration
    - webhook_events with (provider, externalId, eventType) unique constraint — hard idempotency guard

key-files:
  created:
    - pnpm-workspace.yaml (workspace definition)
    - package.json (root scripts and turbo config)
    - turbo.json (build pipeline)
    - docker-compose.yml (Postgres 16 + Redis 7 services)
    - .env.example (all required env vars documented)
    - .gitignore (Node/Next/Prisma ignores)
    - api/prisma/schema.prisma (5 foundation models)
    - api/src/main.ts (NestJS bootstrap, CORS, ValidationPipe)
    - api/src/app.module.ts (root module + health check controller)
    - api/src/prisma/prisma.service.ts (PrismaClient wrapper with lifecycle hooks)
    - api/src/prisma/prisma.module.ts (global Prisma module)
    - packages/shared/src/enums.ts (Role, MarketStatus, ConsentType, ConsentStatus, WebhookEventStatus)
    - packages/shared/src/types/user.ts (UserBase, UserRole, Market, ConsentLog, UserWithRoles interfaces)
    - packages/shared/src/index.ts (barrel export)
    - apps/web/package.json, apps/vendor/package.json, apps/admin/package.json (stubs)
  modified: []

key-decisions:
  - "Roles stored in user_roles table (not a column on users) — many-to-many identity model prevents role-lock at account level"
  - "markets is a first-class table (not a city string column) — enables city expansion without data migration"
  - "webhook_events unique constraint on (provider, externalId, eventType) — hard idempotency guard for Razorpay webhooks"
  - "consent_logs tracks IP address and user agent — DPDP Act compliance evidence"
  - "All IDs are UUID v4 via @default(uuid()) — avoids sequential ID enumeration attacks"
  - "pnpm-workspace.yaml onlyBuiltDependencies for Prisma and NestJS — allows build scripts in strict pnpm security mode"
  - "class-validator and class-transformer added alongside GlobalValidationPipe — required for DTO validation in NestJS"

patterns-established:
  - "Pattern 1: Global PrismaModule — import PrismaModule once in AppModule, PrismaService auto-available everywhere"
  - "Pattern 2: All Prisma models use uuid() PKs and snake_case column names via @map/@db.Uuid"
  - "Pattern 3: CORS configured per-app-port (3000/3002/3003) in main.ts — extend when new apps added"
  - "Pattern 4: packages/shared exports enums and types for use in frontend apps without importing Prisma"

# Metrics
duration: 34min
completed: 2026-03-05
---

# Phase 1 Plan 1: Monorepo Foundation Summary

**pnpm workspace monorepo with Turborepo, Docker Compose (Postgres 16 + Redis 7), NestJS API on :3001, Prisma schema with 5 foundation models, and shared TypeScript enums package**

## Performance

- **Duration:** 34 min
- **Started:** 2026-03-05T05:01:28Z
- **Completed:** 2026-03-05T05:35:49Z
- **Tasks:** 2
- **Files modified:** 17 created, 0 modified

## Accomplishments

- Monorepo scaffold with pnpm workspaces (`apps/*`, `packages/*`, `api`) and Turborepo pipeline
- Docker Compose running Postgres 16-alpine (port 5432, healthy) and Redis 7-alpine (port 6379, healthy)
- NestJS API on port 3001 with Prisma connection, CORS for all frontends, global ValidationPipe
- Prisma schema applied to Dockerized Postgres — 5 tables: users, user_roles, markets, consent_logs, webhook_events
- packages/shared exporting 5 enums (Role, MarketStatus, ConsentType, ConsentStatus, WebhookEventStatus) and TypeScript interfaces

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo with pnpm workspaces, Docker Compose, and app stubs** - `05b5035` (feat)
2. **Task 2: Create NestJS API with Prisma schema and shared types package** - `d1a9b0d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created

- `pnpm-workspace.yaml` — workspace definition with onlyBuiltDependencies for Prisma/NestJS
- `package.json` — root scripts: dev, build, lint, db:push, db:studio, docker:up, docker:down
- `turbo.json` — Turborepo pipeline (build, dev persistent, lint)
- `docker-compose.yml` — Postgres 16-alpine + Redis 7-alpine with healthchecks and named volumes
- `.env.example` — all required environment variables documented
- `.gitignore` — Node.js, Next.js, Prisma, editor ignores
- `api/prisma/schema.prisma` — 5 Prisma models with UUID PKs, snake_case columns, proper constraints
- `api/src/main.ts` — NestJS bootstrap on port 3001, CORS, GlobalValidationPipe
- `api/src/app.module.ts` — root module importing PrismaModule, health check controller at GET /
- `api/src/prisma/prisma.service.ts` — PrismaClient with OnModuleInit/$connect, OnModuleDestroy/$disconnect
- `api/src/prisma/prisma.module.ts` — @Global() module exporting PrismaService
- `packages/shared/src/enums.ts` — Role, MarketStatus, ConsentType, ConsentStatus, WebhookEventStatus enums
- `packages/shared/src/types/user.ts` — UserBase, UserRole, Market, ConsentLog, UserWithRoles interfaces
- `packages/shared/src/index.ts` — barrel export
- `apps/web/package.json`, `apps/vendor/package.json`, `apps/admin/package.json` — workspace stubs

## Decisions Made

- Roles stored in a separate `user_roles` table (not a column on users) — prevents role-lock, enables multi-role identity per the STACK.md multi-role requirement
- Markets as a first-class table (not a city string) — city expansion without data migration
- webhook_events `(provider, externalId, eventType)` unique constraint — hard idempotency guard for Razorpay double-delivery prevention
- consent_logs stores IP address and user agent — DPDP Act compliance evidence trail
- All PKs are UUID v4 via `@default(uuid())` — no sequential ID enumeration
- App stubs (web, vendor, admin) are placeholder package.json files only — Next.js scaffolding deferred to Phases 2/3/4 when those apps are needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed obsolete `version` key from docker-compose.yml**
- **Found during:** Task 1 (docker-compose config validation)
- **Issue:** `version: '3.9'` is deprecated in Docker Compose v2+ and produces warnings
- **Fix:** Removed the `version:` key; Docker Compose now infers schema version automatically
- **Files modified:** `docker-compose.yml`
- **Verification:** `docker-compose config` validates without warnings
- **Committed in:** `05b5035` (Task 1 commit)

**2. [Rule 3 - Blocking] Added class-validator and class-transformer dependencies**
- **Found during:** Task 2 (NestJS API startup)
- **Issue:** NestJS GlobalValidationPipe requires class-validator and class-transformer at runtime; API logged ERROR on startup without them
- **Fix:** Added `class-validator` and `class-transformer` as production dependencies in api/package.json
- **Files modified:** `api/package.json`, `pnpm-lock.yaml`
- **Verification:** NestJS started cleanly, no PackageLoader errors
- **Committed in:** `d1a9b0d` (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed pnpm build script permissions for Prisma and NestJS**
- **Found during:** Task 2 (pnpm install warning about ignored build scripts)
- **Issue:** pnpm v10 blocks postinstall scripts by default; Prisma Client cannot generate without `@prisma/engines` postinstall
- **Fix:** Added `onlyBuiltDependencies` to `pnpm-workspace.yaml` for `@nestjs/core`, `@prisma/client`, `@prisma/engines`, `prisma`
- **Files modified:** `pnpm-workspace.yaml`
- **Verification:** `npx prisma generate` succeeded; Prisma Client generated to node_modules
- **Committed in:** `d1a9b0d` (Task 2 commit)

**4. [Rule 3 - Blocking] Started Docker Desktop before docker-compose up**
- **Found during:** Task 1 (docker-compose up)
- **Issue:** Docker Desktop was not running; daemon pipe unavailable
- **Fix:** Started Docker Desktop programmatically, waited for daemon to be ready
- **Files modified:** None
- **Verification:** `docker version` returned Server info; containers started successfully
- **Committed in:** Not applicable (infrastructure startup, no file changes)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and completion. No scope creep.

## Issues Encountered

- pnpm v10 strict security mode blocked Prisma postinstall scripts — resolved via `onlyBuiltDependencies` in pnpm-workspace.yaml
- Docker Desktop was not running at execution start — started automatically, waited ~90s for daemon readiness
- DNS resolution failed on first `docker-compose up` attempt immediately after Docker Desktop started — retried after brief wait, images pulled successfully

## User Setup Required

None — no external service configuration required. All services run locally via Docker Compose.

## Next Phase Readiness

- Plan 01-02 (OTP Auth) can start immediately — PrismaService available globally, User and UserRole models in DB, Redis running on 6379
- Plan 01-03 (Privacy/Consent) can start immediately — ConsentLog model and PrismaService ready
- Developer onboarding: `pnpm install && pnpm docker:up && pnpm --filter @zevento/api prisma:push && pnpm --filter @zevento/api dev` produces working API at localhost:3001

---
*Phase: 01-foundation*
*Completed: 2026-03-05*
