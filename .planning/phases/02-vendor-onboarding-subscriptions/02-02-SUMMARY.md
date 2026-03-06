---
phase: 02-vendor-onboarding-subscriptions
plan: 02
subsystem: api
tags: [razorpay, subscriptions, webhooks, billing, nestjs, prisma]

requires:
  - phase: 02-vendor-onboarding-subscriptions
    plan: 01
    provides: "VendorProfile model, VendorOwnerGuard, SubscriptionPlan/VendorSubscription/Transaction schema, seed data (4 plans), rawBody enabled in NestFactory"
provides:
  - "RazorpayService: SDK wrapper with dev mock mode, plan CRUD, subscription CRUD, webhook signature verification"
  - "SubscriptionService: plan listing by role, checkout initiation with lazy Razorpay plan sync, subscription cancellation"
  - "SubscriptionController: GET /subscriptions/plans, POST /subscriptions/checkout, GET /subscriptions/me, POST /subscriptions/cancel"
  - "SubscriptionWebhookController: POST /webhooks/razorpay/subscription (public endpoint)"
  - "SubscriptionWebhookService: webhook processing with idempotency, full subscription lifecycle status management, transaction recording"
affects: [02-03-admin-kyc, 03-lead-routing, 05-payments]

tech-stack:
  added: [razorpay]
  patterns: [razorpay-dev-mock, lazy-plan-sync, webhook-idempotency, cancel-at-cycle-end]

key-files:
  created:
    - api/src/subscription/razorpay.service.ts
    - api/src/subscription/subscription.service.ts
    - api/src/subscription/subscription.controller.ts
    - api/src/subscription/subscription.module.ts
    - api/src/subscription/dto/checkout.dto.ts
    - api/src/subscription/webhook/subscription-webhook.controller.ts
    - api/src/subscription/webhook/subscription-webhook.service.ts
  modified:
    - api/src/app.module.ts
    - api/src/vendor/vendor.module.ts
    - api/src/admin/admin.service.ts
    - api/package.json

key-decisions:
  - "RazorpayService uses dev mock mode when env vars missing (same pattern as Cloudinary and MSG91)"
  - "Lazy plan sync: Razorpay plans created on first checkout, not at seed time"
  - "Cancel at cycle end: vendor keeps access until current billing period expires"
  - "Webhook returns 200 even on processing errors to prevent Razorpay retry storms"
  - "Idempotency key: subscriptionId_event_paymentId for uniqueness per charge event"

patterns-established:
  - "Razorpay dev mock: return placeholder data when env vars missing in development"
  - "Lazy sync: create remote resource on first use, cache ID locally"
  - "Webhook idempotency: catch P2002 unique constraint violation to silently skip duplicates"
  - "Cross-module guard reuse: VendorOwnerGuard exported from VendorModule, imported by SubscriptionModule"

duration: 7min
completed: 2026-03-06
---

# Phase 2 Plan 2: Subscription Billing Summary

**Razorpay subscription billing with checkout URL generation, webhook-driven lifecycle management, and transaction ledger recording**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T23:54:49Z
- **Completed:** 2026-03-06T00:01:53Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Razorpay SDK wrapper with full dev mock mode for development without API keys
- Subscription checkout flow: vendors select a plan, receive a Razorpay payment URL, system tracks lifecycle
- Webhook handler processes all 9 Razorpay subscription events with idempotency and transaction recording

## Task Commits

Each task was committed atomically:

1. **Task 1: Razorpay service wrapper and subscription service** - `c6c2944` (feat)
2. **Task 2: Razorpay subscription webhook handler** - `4fa3551` (feat)

## Files Created/Modified
- `api/src/subscription/razorpay.service.ts` - Razorpay SDK wrapper with dev mock mode, plan/subscription CRUD, HMAC-SHA256 webhook verification
- `api/src/subscription/subscription.service.ts` - Plan listing by role, checkout initiation with lazy Razorpay plan sync, cancel at cycle end
- `api/src/subscription/subscription.controller.ts` - 4 endpoints: plans, checkout, me, cancel (JwtAuthGuard + RolesGuard + VendorOwnerGuard)
- `api/src/subscription/subscription.module.ts` - Module wiring with VendorModule import for VendorOwnerGuard
- `api/src/subscription/dto/checkout.dto.ts` - Checkout DTO with UUID validation
- `api/src/subscription/webhook/subscription-webhook.controller.ts` - Public webhook endpoint, raw body handling, signature-fail = 401, processing-fail = 200
- `api/src/subscription/webhook/subscription-webhook.service.ts` - Full lifecycle processing with idempotency via webhook_events table, transaction creation on charge
- `api/src/app.module.ts` - Added SubscriptionModule import
- `api/src/vendor/vendor.module.ts` - Exported VendorOwnerGuard for cross-module use
- `api/src/admin/admin.service.ts` - Fixed Prisma JSON type casting for subscription plan features
- `api/package.json` - Added razorpay dependency

## Decisions Made
- RazorpayService uses dev mock mode when RAZORPAY_KEY_ID/KEY_SECRET not set (consistent with MSG91 and Cloudinary patterns)
- Lazy plan sync: Razorpay plans are created on first checkout rather than at seed time, avoiding need for API keys during development
- Cancel at cycle end (cancelAtCycleEnd=true): vendor retains access until current billing period expires
- Webhook always returns 200 on processing errors to prevent Razorpay retry storms; errors logged server-side
- Idempotency key format: `${subscriptionId}_${event}_${paymentId|timestamp}` ensures uniqueness per charge event while allowing same subscription to have multiple charge records
- process.env used directly (consistent with existing codebase) rather than introducing @nestjs/config

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma JSON type error in admin service**
- **Found during:** Task 1 (build verification)
- **Issue:** Pre-existing build error in admin.service.ts: `Record<string, unknown> | null` not assignable to Prisma's `NullableJsonNullValueInput | InputJsonValue`
- **Fix:** Added `Prisma` import and cast `dto.features` through `Prisma.InputJsonValue`
- **Files modified:** api/src/admin/admin.service.ts
- **Verification:** `pnpm build` succeeds
- **Committed in:** `c6c2944` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Pre-existing type error blocking build. No scope creep.

## Issues Encountered
None

## User Setup Required

Razorpay credentials are optional for development (mock mode returns placeholder data). For production or real subscription billing:
- `RAZORPAY_KEY_ID` - from Razorpay Dashboard > Settings > API Keys > Key Id
- `RAZORPAY_KEY_SECRET` - from Razorpay Dashboard > Settings > API Keys > Key Secret (shown once)
- `RAZORPAY_WEBHOOK_SECRET` - from Razorpay Dashboard > Settings > Webhooks > Create webhook > Secret
- Create webhook endpoint in Razorpay Dashboard pointing to `https://{your-api}/webhooks/razorpay/subscription` with events: subscription.authenticated, subscription.activated, subscription.charged, subscription.pending, subscription.halted, subscription.cancelled, subscription.paused, subscription.resumed, subscription.completed

## Next Phase Readiness
- Subscription billing complete and ready for vendor use after KYC approval (02-03)
- RazorpayService exported for potential reuse in Phase 5 (payment splitting)
- Transaction records ready for financial reporting in admin dashboard
- Webhook infrastructure reusable for future Razorpay event types (payment links, orders)

---
*Phase: 02-vendor-onboarding-subscriptions*
*Completed: 2026-03-06*

## Self-Check: PASSED
- All 7 created files verified on disk
- Both task commits (c6c2944, 4fa3551) verified in git log
