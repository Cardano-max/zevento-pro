---
phase: 05-payments-and-commission-settlement
plan: "02"
subsystem: api
tags: [razorpay, razorpayx, webhooks, payouts, bullmq, commission, idempotency, nestjs]

requires:
  - phase: 05-payments-and-commission-settlement
    plan: "01"
    provides: "PaymentModule, CommissionService, RazorpayService with createOrder/validatePaymentSignature, Transaction model with commission fields, Booking with paymentStatus/commissionRateBps"
  - phase: 02-vendor-onboarding-subscriptions
    plan: "02"
    provides: "RazorpayService with dev mock mode and validateWebhookSignature, SubscriptionWebhookService P2002 idempotency pattern, webhook_events table"
  - phase: 04-vendor-crm-and-booking-flow
    plan: "03"
    provides: "BookingService.transitionStatus with state machine and push notifications"
provides:
  - "PaymentWebhookController: POST /webhooks/razorpay/payment (public, no auth guards)"
  - "PaymentWebhookService: webhook signature verification, P2002 idempotency, event routing (payment.captured/failed, refund.processed)"
  - "PaymentProcessor: BullMQ worker for commission split calculation and BOOKING_COMMISSION Transaction creation"
  - "PayoutService: RazorpayX Composite Payout API wrapper with dev mock mode and X-Payout-Idempotency header"
  - "PayoutProcessor: BullMQ worker for vendor payout execution (only for COMPLETED bookings)"
  - "BookingService payout trigger: enqueues vendor-payout job when booking transitions to COMPLETED"
  - "Two BullMQ queues registered: payment-processing, vendor-payout"
affects: [05-03-admin-payment-management]

tech-stack:
  added: []
  patterns:
    - "Payment webhook idempotency: P2002 catch on webhook_events unique constraint (identical to subscription webhook pattern)"
    - "Async payment processing: webhook enqueues BullMQ job, processor handles commission calc and Transaction creation"
    - "Payout triggered on booking COMPLETED, not payment capture (Pitfall 5 from research)"
    - "RazorpayX Composite Payout via raw HTTP with mandatory X-Payout-Idempotency header (Pitfall 7)"
    - "PayoutService dev mock mode when RAZORPAY_X_KEY_ID not set (consistent with RazorpayService, MSG91, Cloudinary, Firebase)"
    - "Bank detail validation returns PENDING_BANK_DETAILS status without throwing (graceful degradation)"

key-files:
  created:
    - api/src/payment/webhook/payment-webhook.controller.ts
    - api/src/payment/webhook/payment-webhook.service.ts
    - api/src/payment/processor/payment.processor.ts
    - api/src/payment/processor/payout.processor.ts
    - api/src/payment/payout.service.ts
  modified:
    - api/src/payment/payment.module.ts
    - api/src/booking/booking.service.ts
    - api/src/booking/booking.module.ts

key-decisions:
  - "Webhook always returns 200 even on processing errors -- prevents Razorpay retry storms (consistent with subscription webhook pattern)"
  - "Payment processing is async via BullMQ, not synchronous in webhook handler -- decouples webhook acknowledgment from business logic"
  - "PayoutService uses raw HTTP for RazorpayX (not in Razorpay SDK, Pitfall 1) with dev mock mode for development"
  - "Payout triggered only on booking COMPLETED transition, not on payment capture (Pitfall 5: prevents payout before service delivery)"
  - "PayoutProcessor double-checks booking COMPLETED status (defense in depth against race conditions)"
  - "Missing bank details return PENDING_BANK_DETAILS status without throwing -- payout can be retried when vendor adds bank info"

patterns-established:
  - "Payment webhook event routing: payment.captured -> BullMQ async, payment.failed/refund.processed -> direct DB update"
  - "Commission split calculation: totalPaise * rateBps / 10000, using locked rate from booking (not current rate table)"
  - "Booking completion triggers: payout job enqueued outside $transaction (consistent with Redis cache invalidation pattern from Phase 4)"
  - "RazorpayX payout idempotency: payout_{bookingId}_{razorpayPaymentId} as X-Payout-Idempotency header"

duration: 5min
completed: 2026-03-13
---

# Phase 5 Plan 02: Payment Webhook Processing, Commission Calculation, and RazorpayX Vendor Payouts

**Payment webhook handler with P2002 idempotency, BullMQ payment processor for commission split and Transaction ledger, and PayoutService for RazorpayX vendor disbursement triggered on booking completion**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T04:25:17Z
- **Completed:** 2026-03-13T04:30:54Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Payment webhook endpoint at POST /webhooks/razorpay/payment with signature verification, P2002 idempotency, and event routing for payment.captured, payment.failed, and refund.processed events
- BullMQ payment processor calculates commission split using the rate locked on the booking, creates BOOKING_COMMISSION Transaction with commission and net payout breakdown, and updates booking paymentStatus
- PayoutService wraps RazorpayX Composite Payout API with dev mock mode, mandatory X-Payout-Idempotency header, and graceful bank detail validation (PENDING_BANK_DETAILS status)
- BookingService.transitionStatus triggers vendor-payout BullMQ job when booking reaches COMPLETED, finding the BOOKING_COMMISSION transaction for the net payout amount

## Task Commits

Each task was committed atomically:

1. **Task 1: Payment webhook controller, webhook service, and payment processing worker** - `58ed3ed` (feat)
2. **Task 2: PayoutService (RazorpayX) and payout processor with booking-completion trigger** - `bf4e404` (feat)

## Files Created/Modified
- `api/src/payment/webhook/payment-webhook.controller.ts` - POST /webhooks/razorpay/payment public endpoint with raw body + signature verification (53 lines)
- `api/src/payment/webhook/payment-webhook.service.ts` - Webhook event processing with idempotency via webhook_events table, BullMQ enqueueing, payment.failed and refund.processed handlers (197 lines)
- `api/src/payment/processor/payment.processor.ts` - BullMQ worker: commission calculation, Transaction creation, booking paymentStatus update (128 lines)
- `api/src/payment/processor/payout.processor.ts` - BullMQ worker: vendor payout execution via PayoutService when booking is COMPLETED (101 lines)
- `api/src/payment/payout.service.ts` - RazorpayX Composite Payout API wrapper with dev mock mode and idempotency header (148 lines)
- `api/src/payment/payment.module.ts` - Added BullMQ queues, webhook controller/service, payment/payout processors, PayoutService
- `api/src/booking/booking.service.ts` - Added vendor-payout BullMQ job trigger on COMPLETED transition
- `api/src/booking/booking.module.ts` - Added BullModule.registerQueue for vendor-payout queue

## Decisions Made
- Webhook always returns 200 on processing errors (consistent with subscription webhook pattern; prevents Razorpay retry storms)
- Payment processing is async via BullMQ, not synchronous in webhook handler (decouples webhook acknowledgment from business logic)
- PayoutService uses raw HTTP for RazorpayX Composite Payout API (not in the Razorpay Node SDK, Pitfall 1 from research)
- Payout triggered only on booking COMPLETED transition, not on payment capture (Pitfall 5: prevents paying vendor before service is delivered)
- PayoutProcessor double-checks booking COMPLETED status before calling PayoutService (defense in depth for race conditions)
- Missing bank details return PENDING_BANK_DETAILS status without throwing -- payout can be retried later when vendor adds bank info (no crash, no data loss)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

RazorpayX credentials are optional for development (dev mock mode returns placeholder data). For production vendor payouts:
- `RAZORPAY_X_KEY_ID` - from RazorpayX Dashboard > Settings > API Keys
- `RAZORPAY_X_KEY_SECRET` - from RazorpayX Dashboard > Settings > API Keys
- `RAZORPAY_X_ACCOUNT_NUMBER` - from RazorpayX Dashboard > Account Details

**Important:** RazorpayX requires a separate KYC approval (2-4 weeks). Application should have been submitted during Phase 2 (flagged as a blocker in ROADMAP.md). Verify approval status before production deployment.

## Next Phase Readiness
- Full payment flow is operational: webhook -> idempotency check -> BullMQ job -> commission calc -> Transaction -> payout on COMPLETED
- PayoutService exported from PaymentModule for potential admin use in Plan 05-03
- Transaction model supports payoutStatus tracking for admin dashboard queries
- Refund handling (refund.processed webhook) updates Transaction and Booking status

## Self-Check: PASSED

| Item | Status |
|------|--------|
| api/src/payment/webhook/payment-webhook.controller.ts | FOUND (55 lines) |
| api/src/payment/webhook/payment-webhook.service.ts | FOUND (229 lines) |
| api/src/payment/processor/payment.processor.ts | FOUND (130 lines) |
| api/src/payment/processor/payout.processor.ts | FOUND (104 lines) |
| api/src/payment/payout.service.ts | FOUND (159 lines) |
| api/src/payment/payment.module.ts | FOUND (32 lines) |
| api/src/booking/booking.service.ts | FOUND (338 lines) |
| api/src/booking/booking.module.ts | FOUND (30 lines) |
| Commit 58ed3ed | FOUND |
| Commit bf4e404 | FOUND |
| P2002 idempotency in webhook service | FOUND |
| paymentQueue.add in webhook service | FOUND |
| transaction.create in processor | FOUND |
| X-Payout-Idempotency in PayoutService | FOUND |
| devMode in PayoutService | FOUND |
| payoutQueue.add in BookingService | FOUND |
| No transaction.create in webhook service | CONFIRMED (correct) |
| pnpm build | 0 errors |

---
*Phase: 05-payments-and-commission-settlement*
*Completed: 2026-03-13*
