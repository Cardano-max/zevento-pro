# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Customers can discover and book event services while the platform intelligently routes qualified leads to the best-matched vendors, creating value for both sides of the marketplace.
**Current focus:** Phase 2 — Vendor Onboarding & Subscriptions

## Current Position

Phase: 2 of 7 (Vendor Onboarding & Subscriptions)
Plan: 3 of 3 in current phase
Status: 02-03 complete — admin operations API (KYC review, categories, plans, notifications)
Last activity: 2026-03-06 — 02-03 complete (admin KYC review, category CRUD, plan management, notifications)

Progress: [███░░░░░░░] 29% (6/21 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 17 min
- Total execution time: 1.54 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 75 min | 25 min |
| 02-vendor-onboarding-subscriptions | 3/3 | 18 min | 6 min |

**Recent Trend:**
- Last 5 plans: 01-02 (34 min est), 01-03 (7 min), 02-01 (13 min), 02-03 (5 min)
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
- [02-02]: RazorpayService uses dev mock mode when env vars missing — consistent with MSG91 and Cloudinary patterns
- [02-02]: Lazy plan sync — Razorpay plans created on first checkout, not at seed time
- [02-02]: Cancel at cycle end — vendor retains access until current billing period expires
- [02-02]: Webhook returns 200 on processing errors to prevent Razorpay retry storms
- [02-02]: Idempotency key: subscriptionId_event_paymentId — unique per charge event
- [Phase 02-03]: KYC review creates AdminNotification in same transaction — atomic audit trail
- [Phase 02-03]: Subscription plan price change resets razorpayPlanId to null — forces lazy re-creation (Razorpay plans immutable)
- [Phase 02-03]: Category slug collision on rename appends numeric suffix — prevents uniqueness violation

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
Stopped at: Completed 02-02-PLAN.md — subscription billing (Razorpay checkout, webhook lifecycle, transaction ledger). 02-03 state already advanced.
Resume file: None
