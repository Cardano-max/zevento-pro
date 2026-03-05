# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Customers can discover and book event services while the platform intelligently routes qualified leads to the best-matched vendors, creating value for both sides of the marketplace.
**Current focus:** Phase 2 — Vendor Onboarding & Subscriptions

## Current Position

Phase: 2 of 7 (Vendor Onboarding & Subscriptions)
Plan: 1 of 3 in current phase
Status: 02-01 complete — vendor onboarding schema, Cloudinary, and progressive onboarding API
Last activity: 2026-03-06 — 02-01 complete (Phase 2 schema, Cloudinary upload, vendor onboarding Steps 2-5)

Progress: [██░░░░░░░░] 19% (4/21 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 22 min
- Total execution time: 1.46 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 75 min | 25 min |
| 02-vendor-onboarding-subscriptions | 1/3 | 13 min | 13 min |

**Recent Trend:**
- Last 5 plans: 01-01 (34 min), 01-02 (34 min est), 01-03 (7 min), 02-01 (13 min)
- Trend: execution accelerating with established patterns and schema conventions

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Multi-role identity schema and PostGIS geography must be locked in Phase 1 — cannot be retrofitted post-launch
- [Roadmap]: Vendor onboarding and subscription billing ship before lead routing engine (scoring algorithm weights subscription tier 30%)
- [Roadmap]: B2B product marketplace deferred to Phase 6 — after core lead-to-booking-to-payment flywheel is validated
- [Roadmap]: Razorpay Payout KYC application must be submitted during Phase 2 (approval takes 2-4 weeks; blocks Phase 5 payouts)
- [Roadmap]: TRAI DLT SMS template registration must be completed before Phase 1 development ends (unregistered templates are operator-blocked)
- [01-01]: Roles stored in user_roles table (not users.role column) — multi-role identity, prevents role-lock at account level
- [01-01]: markets is a first-class table (not city string) — city expansion without data migration
- [01-01]: webhook_events (provider, externalId, eventType) unique constraint — hard idempotency guard for Razorpay double-delivery
- [01-01]: All IDs are UUID v4 — no sequential ID enumeration attacks
- [01-01]: pnpm-workspace.yaml onlyBuiltDependencies for Prisma/NestJS — resolves pnpm v10 strict build script security mode
- [01-03]: Consent stored as append-only log — never mutate GRANTED records; REVOKED always creates new row (DPDP Act compliance)
- [01-03]: ConsentRequiredGuard logs BOTH granted and denied access attempts — denied access is auditable for compliance
- [01-03]: ADMIN role bypasses consent guard in all paths — can view any data for compliance and support purposes
- [01-03]: AuditLogService reuses consent_logs table with auditEvent metadata — avoids schema migration for audit trail
- [Phase 01-02]: MSG91 skips API in dev mode (NODE_ENV=development) — OTP logged to console to prevent SMS cost during development
- [Phase 01-02]: JWT expiry 7 days — mobile-first long session UX, no refresh token rotation needed at this phase
- [Phase 01-02]: JwtStrategy validates user against DB on every request — prevents stale token attacks after deactivation or role revocation
- [Phase 01-02]: Admin role revocation uses soft-delete (isActive=false, revokedAt) — preserves audit trail, never hard-deletes role records
- [02-01]: PostGIS image is backward-compatible drop-in — no existing queries affected, enables Phase 3 geography
- [02-01]: onboardingStep uses max(current, N) — vendors can revisit earlier steps without losing progress
- [02-01]: Cloudinary returns mock data in dev when env vars missing — prevents blocking development
- [02-01]: VendorOwnerGuard attaches vendorId to req — simpler controller signatures, ADMIN bypasses
- [02-01]: All pricing amounts in paise — consistent with Indian payment conventions

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 1]: TRAI DLT registration — submit OTP + transactional SMS templates to MSG91 before any OTP SMS can be sent. Ops action, not a code task.
- [Pre-Phase 2]: Razorpay Payout (RazorpayX) KYC — submit application during Phase 2; approval timeline 2-4 weeks; missing this gate blocks Phase 5 vendor payouts.
- [Phase 3 planning]: PostGIS + Prisma integration — Prisma has no native PostGIS support; research prisma-extension-postgis vs. raw SQL before Phase 3 planning begins.
- [Phase 5 planning]: Razorpay commission split mechanics and GST category rate handling need research before Phase 5 planning begins.
- [Phase 6 planning]: Kiwi Party / Birthday Kart integration contract must be defined before Phase 6 begins (Shopify webhook vs. CSV vs. custom API determines entire B2B architecture).
- [Legal]: India DPDP Act consent implementation rules are evolving — get legal review before launch.

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 02-01-PLAN.md — vendor onboarding schema, Cloudinary, progressive API. Next: 02-02 (subscription billing).
Resume file: None
