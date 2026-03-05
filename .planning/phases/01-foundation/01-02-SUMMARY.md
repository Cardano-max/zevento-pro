---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [nestjs, jwt, passport, otp, msg91, redis, rate-limiting, guards, rbac, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: PrismaService (global), User model, UserRole model, Redis on :6379, NestJS API on :3001

provides:
  - POST /auth/otp/send — rate-limited OTP delivery (MSG91 prod, console dev), masked phone response
  - POST /auth/otp/verify — OTP verification returning JWT with userId/phone/activeRole, auto-creates CUSTOMER user
  - SHA-256 hashed OTP storage in Redis with 10-min TTL and replay-attack protection
  - Rate limiting: 5 send + 5 verify attempts per phone per hour via Redis INCR counters
  - JwtAuthGuard — Passport JWT strategy validating Bearer tokens, checking user active status and role in DB
  - RolesGuard — CanActivate guard enforcing @Roles decorator metadata against user.activeRole
  - @Roles decorator and @CurrentUser decorator for controller-level auth annotations
  - AdminModule: GET/POST/DELETE /admin/users/* endpoints (ADMIN-only, guarded)
  - Admin role management: assignRole (with grantedBy audit), revokeRole (soft-delete), listUsers (paginated)
  - Multi-role identity: users can hold CUSTOMER + PLANNER + ADMIN simultaneously, select active role at verify time

affects:
  - 01-03 (privacy/consent — already implemented; now uses real JwtAuthGuard instead of placeholder stub)
  - all downstream phases (every protected route uses JwtAuthGuard + RolesGuard pattern)
  - Phase 2 (vendor onboarding — vendors authenticate via same OTP flow, get SUPPLIER role assigned by admin)
  - Phase 3+ (lead routing, payments — all use JWT activeRole for authorization)

# Tech tracking
tech-stack:
  added:
    - "@nestjs/jwt ^10.x" (JWT signing/verification)
    - "@nestjs/passport ^10.x" (Passport integration for NestJS)
    - "passport ^0.7.x" (authentication middleware)
    - "passport-jwt ^4.x" (JWT strategy for Passport)
    - "@types/passport-jwt ^4.x" (TypeScript types)
  patterns:
    - OTP hashed with SHA-256 before Redis storage — raw OTPs never persisted
    - OTP deleted from Redis on first successful verify — replay attacks impossible
    - Rate limiting uses Redis INCR with TTL set only on first increment — atomic, no race condition
    - JWT payload: { userId, phone, activeRole } — activeRole drives all RBAC decisions
    - JwtStrategy validates every token against DB (user.isActive + role exists) — no stale token risk
    - RolesGuard reads @Roles metadata with getAllAndOverride (handler > class) — composable access control
    - Admin role operations use soft-delete (isActive=false, revokedAt=now) — full audit trail preserved

key-files:
  created:
    - api/src/redis/redis.service.ts (ioredis wrapper: get/set/del/incr/expire/ttl with error handling)
    - api/src/redis/redis.module.ts (@Global module exporting RedisService)
    - api/src/auth/otp.service.ts (OTP generate, hash-store, verify with replay protection)
    - api/src/auth/msg91.service.ts (MSG91 API v5 OTP send; dev mode console log)
    - api/src/auth/rate-limit.service.ts (5/hr send + verify limits via Redis INCR)
    - api/src/auth/dto/send-otp.dto.ts (+91XXXXXXXXXX regex validation)
    - api/src/auth/dto/verify-otp.dto.ts (phone + 6-digit OTP + optional role)
    - api/src/auth/auth.service.ts (sendOtp + verifyOtp orchestration)
    - api/src/auth/auth.controller.ts (POST /auth/otp/send, POST /auth/otp/verify)
    - api/src/auth/auth.module.ts (JwtModule 7d expiry, PassportModule, JwtStrategy)
    - api/src/auth/interfaces/jwt-payload.interface.ts (JwtPayload: userId, phone, activeRole)
    - api/src/auth/strategies/jwt.strategy.ts (ExtractJwt.fromAuthHeaderAsBearerToken, DB validation)
    - api/src/auth/guards/jwt-auth.guard.ts (extends AuthGuard('jwt') — replaces placeholder stub)
    - api/src/auth/guards/roles.guard.ts (CanActivate, reads ROLES_KEY metadata, throws ForbiddenException)
    - api/src/auth/decorators/roles.decorator.ts (@Roles(...roles) via SetMetadata)
    - api/src/auth/decorators/current-user.decorator.ts (@CurrentUser() param decorator from request.user)
    - api/src/admin/dto/manage-role.dto.ts (AssignRoleDto: role IsIn CUSTOMER/PLANNER/SUPPLIER/ADMIN)
    - api/src/admin/admin.service.ts (assignRole, revokeRole, listUsers, getUser)
    - api/src/admin/admin.controller.ts (ADMIN-guarded REST endpoints for role management)
    - api/src/admin/admin.module.ts (imports PrismaModule + AuthModule)
  modified:
    - api/src/app.module.ts (added RedisModule, AuthModule, AdminModule imports)
    - api/src/privacy/privacy.module.ts (bug fix: added MaskPhoneInterceptor to providers)
    - api/package.json (added @nestjs/jwt, @nestjs/passport, passport, passport-jwt)

key-decisions:
  - "MSG91 integration skips API call in development (NODE_ENV=development) — OTP logged to console; prevents burning SMS credits during dev"
  - "JWT expiry set to 7 days for mobile-first UX (long session, no refresh token needed at this stage)"
  - "Rate limit enforced at RateLimitService layer before OTP verify attempt — counter incremented on every verify call, not just failures; this means 5th attempt triggers 429 before reaching OTP check"
  - "OTP verify rate limit counter reset on successful verification (resetOnSuccess) — user not permanently penalized after success"
  - "Admin role revocation uses soft-delete (isActive=false + revokedAt timestamp) — preserves audit trail for compliance"
  - "JwtStrategy validates token against DB on every request — slightly more expensive but prevents stale token attacks after user deactivation or role revocation"

patterns-established:
  - "Pattern 5: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('ROLE') — standard protected endpoint pattern for all downstream modules"
  - "Pattern 6: @CurrentUser() user: UserWithActiveRole — standard way to access authenticated user in controller methods"
  - "Pattern 7: Global RedisModule — RedisService auto-available in all modules without per-module imports (same as PrismaModule)"
  - "Pattern 8: Dev/prod service branching via NODE_ENV — MSG91 uses console.log in development, real API in production"

# Metrics
duration: 8min
completed: 2026-03-05
---

# Phase 1 Plan 2: OTP Auth and Role Management Summary

**Phone OTP authentication with SHA-256-hashed Redis storage, MSG91 integration, Redis rate limiting (5/hr), JWT sessions (7d), Passport JWT guard with DB validation, RBAC via @Roles + RolesGuard, and admin role assignment/revocation API**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-05T05:38:45Z
- **Completed:** 2026-03-05T05:47:37Z
- **Tasks:** 2
- **Files modified:** 20 created, 3 modified

## Accomplishments

- Full OTP auth chain: POST /auth/otp/send -> POST /auth/otp/verify -> JWT with userId/phone/activeRole
- Rate limiting: max 5 send and 5 verify attempts per phone per hour (Redis INCR counters)
- OTPs SHA-256 hashed in Redis, deleted on first successful use (replay attack protection)
- JWT Passport strategy validates against DB on every request; JwtAuthGuard and RolesGuard protect all admin routes
- Admin role management: assign role (with grantedBy audit), soft-revoke (isActive=false, revokedAt set), paginated user list
- Multi-role users can select active role at OTP verify time; default falls back to CUSTOMER

## Task Commits

Each task was committed atomically:

1. **Task 1: OTP auth flow with MSG91, Redis storage, and rate limiting** - `2b2e1b5` (feat)
2. **Task 2: JWT strategy, multi-role guards, and admin role management** - `f370a05` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created

- `api/src/redis/redis.service.ts` — ioredis wrapper with get/set/del/incr/expire/ttl and reconnect retry logic
- `api/src/redis/redis.module.ts` — @Global module; RedisService available everywhere without per-module import
- `api/src/auth/otp.service.ts` — SHA-256 OTP generation (crypto.randomInt), 10-min TTL, delete-on-verify replay protection
- `api/src/auth/msg91.service.ts` — MSG91 API v5 POST integration; NODE_ENV=development logs OTP to console
- `api/src/auth/rate-limit.service.ts` — 5 send / 5 verify limits per phone per hour; resetOnSuccess clears verify counter
- `api/src/auth/dto/send-otp.dto.ts` — `+91XXXXXXXXXX` regex validation via class-validator @Matches
- `api/src/auth/dto/verify-otp.dto.ts` — phone + @Length(6,6) OTP + optional role field
- `api/src/auth/auth.service.ts` — orchestrates sendOtp and verifyOtp with auto CUSTOMER role creation
- `api/src/auth/auth.controller.ts` — POST /auth/otp/send and POST /auth/otp/verify (public endpoints)
- `api/src/auth/auth.module.ts` — JwtModule (7d expiry), PassportModule, all providers registered
- `api/src/auth/interfaces/jwt-payload.interface.ts` — JwtPayload typed interface
- `api/src/auth/strategies/jwt.strategy.ts` — ExtractJwt Bearer, DB user lookup + active status + role check
- `api/src/auth/guards/jwt-auth.guard.ts` — extends AuthGuard('jwt') (replaced placeholder from 01-03)
- `api/src/auth/guards/roles.guard.ts` — reads ROLES_KEY metadata, ForbiddenException on mismatch
- `api/src/auth/decorators/roles.decorator.ts` — @Roles(...roles) SetMetadata decorator
- `api/src/auth/decorators/current-user.decorator.ts` — @CurrentUser() extracts request.user
- `api/src/admin/dto/manage-role.dto.ts` — AssignRoleDto with @IsIn role validation
- `api/src/admin/admin.service.ts` — assignRole (duplicate check), revokeRole (soft-delete), listUsers (paginated), getUser
- `api/src/admin/admin.controller.ts` — @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN') on all endpoints
- `api/src/admin/admin.module.ts` — imports PrismaModule and AuthModule for DI chain

## Files Modified

- `api/src/app.module.ts` — added RedisModule, AuthModule, AdminModule, PrivacyModule imports
- `api/src/privacy/privacy.module.ts` — added MaskPhoneInterceptor to providers (pre-existing bug fix)
- `api/package.json` — added @nestjs/jwt, @nestjs/passport, passport, passport-jwt, @types/passport-jwt

## Decisions Made

- MSG91 dev mode skips API (logs OTP to console) — prevents burning SMS credits during development
- JWT 7-day expiry for mobile-first UX; no refresh token rotation needed at this phase
- Rate limit counter increments on every verify call (not just failed ones) — 5th attempt triggers 429 before OTP check; consistent with plan spec
- JwtStrategy validates user against DB on every request — prevents stale tokens post-deactivation
- Admin role revocation uses soft-delete — isActive=false and revokedAt preserved for audit trail

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PrivacyModule startup crash — MaskPhoneInterceptor exported but not provided**
- **Found during:** Task 2 (API startup verification)
- **Issue:** PrivacyModule exported MaskPhoneInterceptor without listing it in providers; NestJS threw "cannot export a provider/module that is not a part of the currently processed module" on startup
- **Fix:** Added MaskPhoneInterceptor to the providers array in privacy.module.ts
- **Files modified:** `api/src/privacy/privacy.module.ts`
- **Verification:** API started successfully; all routes resolved; health check returned 200
- **Committed in:** `f370a05` (Task 2 commit)

**2. [Rule 3 - Blocking] Rebuilt shared package before API build**
- **Found during:** Task 1 (initial build attempt)
- **Issue:** `@zevento/shared` had `types/consent.ts` with ConsentRecord/ConsentCheckResult types but the package had not been rebuilt since the file was added; API build failed with "Module has no exported member 'ConsentRecord'"
- **Fix:** Ran `pnpm --filter @zevento/shared build` to regenerate TypeScript declarations
- **Files modified:** `packages/shared/dist/` (generated — not committed)
- **Verification:** `pnpm --filter @zevento/api build` succeeded with no errors
- **Committed in:** N/A (build artifact, not source file)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for startup correctness. No scope creep.

## Issues Encountered

- PrivacyModule (from prior 01-03 session) had a broken providers/exports mismatch that caused API startup crash — fixed inline
- Shared package type declarations stale from prior session — `pnpm build` on shared resolved immediately

## User Setup Required

**External services require manual configuration.**

MSG91 credentials needed for production OTP delivery:

| Variable | Source |
|---|---|
| `MSG91_AUTH_KEY` | MSG91 Dashboard -> API Keys |
| `MSG91_TEMPLATE_ID` | MSG91 Dashboard -> Templates -> Create OTP Template |
| `MSG91_SENDER_ID` | MSG91 Dashboard -> Sender IDs (6 chars, e.g. ZEVNTO) |

**TRAI DLT registration:** OTP SMS template must be registered with TRAI before MSG91 can deliver SMS in production. This is an ops action — see blocker in STATE.md.

In development (NODE_ENV=development), no MSG91 credentials are required — OTP is logged to console.

## Next Phase Readiness

- Plan 01-03 (Privacy/Consent) is already complete — ConsentController uses real JwtAuthGuard now (placeholder replaced)
- Phase 2 (Vendor Onboarding) can use OTP auth for vendor registration — SUPPLIER role assignable via admin API
- All protected routes in downstream phases use: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ROLE')`
- Admin seeding: to bootstrap the first admin, manually INSERT a row into user_roles with role='ADMIN' after first OTP verify

---
*Phase: 01-foundation*
*Completed: 2026-03-05*

## Self-Check: PASSED

All 17 key files verified present on disk. Both task commits (2b2e1b5, f370a05) confirmed in git log.
