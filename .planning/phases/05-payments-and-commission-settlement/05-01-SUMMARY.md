---
phase: 05-payments-and-commission-settlement
plan: "01"
subsystem: api
tags: [razorpay, payments, commission, prisma, nestjs, booking-checkout]

requires:
  - phase: 02-vendor-onboarding-subscriptions
    plan: "02"
    provides: "RazorpayService with dev mock mode, SubscriptionModule exporting RazorpayService, Transaction model, webhook_events idempotency pattern"
  - phase: 04-vendor-crm-and-booking-flow
    plan: "02"
    provides: "Booking model created from quote acceptance, Quote.totalPaise for payment amounts"
provides:
  - "CommissionRate Prisma model with categoryId/vendorRole specificity cascade"
  - "CommissionService: database-driven rate lookup (category+role > category > role > default)"
  - "PaymentService: createBookingOrder (Razorpay order + commission rate lock) and verifyPayment (HMAC signature validation)"
  - "PaymentController: POST /payments/orders and POST /payments/verify (CUSTOMER role)"
  - "RazorpayService extended: createOrder, validatePaymentSignature, createRefund (all with dev mock mode)"
  - "Transaction model evolved: optional vendorSubscriptionId, bookingId, commissionPaise, netPayoutPaise, razorpayOrderId, razorpayPayoutId, payoutStatus"
  - "Booking model extended: razorpayOrderId, paymentStatus, commissionRateBps"
  - "VendorProfile extended: bankAccountName, bankAccountNumber, bankIfsc"
  - "PaymentStatus and PayoutStatus shared enums"
  - "Default 5% commission rate seeded (500 bps, global default)"
affects: [05-02-payment-webhook-payouts, 05-03-admin-payment-management]

tech-stack:
  added: []
  patterns:
    - "Commission rate specificity cascade: most specific match wins (category+role > category > role > global default)"
    - "Commission rate locked at order creation time (not payment time) to prevent disputes on rate changes"
    - "Client-side payment verification is optimistic UX only; webhook is source of truth for Transaction creation"
    - "PaymentService does NOT create Transaction records in verifyPayment (avoids race with webhook, Pitfall 3)"

key-files:
  created:
    - api/src/payment/commission.service.ts
    - api/src/payment/payment.service.ts
    - api/src/payment/payment.controller.ts
    - api/src/payment/payment.module.ts
    - api/src/payment/dto/create-order.dto.ts
    - api/src/payment/dto/verify-payment.dto.ts
    - api/prisma/migrations/20260313000000_phase5_payments_commission/migration.sql
  modified:
    - api/prisma/schema.prisma
    - packages/shared/src/enums.ts
    - api/src/subscription/razorpay.service.ts
    - api/src/app.module.ts

key-decisions:
  - "Commission rate locked on Booking at order creation time -- prevents disputes when admin changes rates for existing unpaid bookings"
  - "verifyPayment does NOT create Transaction record -- avoids Pitfall 3 race between client verification and webhook"
  - "Transaction.vendorSubscriptionId made optional with onDelete: SetNull -- enables booking commission transactions without subscription link"
  - "RazorpayService.keySecret stored as private field for payment signature HMAC validation"
  - "Default commission rate 500 bps (5%) seeded as global fallback -- more specific rates addable by admin in Plan 05-03"

patterns-established:
  - "Commission specificity cascade: ORDER BY categoryId DESC NULLS LAST, vendorRole DESC NULLS LAST"
  - "Payment order creation pattern: validate booking state, lock commission rate, create Razorpay order, return keyId for client checkout"
  - "Optimistic payment verification: update booking paymentStatus immediately, let webhook handle Transaction creation"

duration: 5min
completed: 2026-03-13
---

# Phase 5 Plan 01: Prisma Schema Evolution and PaymentModule with Razorpay Order Checkout

**CommissionRate table with specificity cascade rate lookup, Razorpay Orders API integration for booking checkout, and client-side payment signature verification with optimistic booking status update**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T04:16:32Z
- **Completed:** 2026-03-13T04:21:50Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Prisma schema evolved for Phase 5: CommissionRate model, Transaction generalized from subscription-only to all revenue types, Booking and VendorProfile extended with payment/bank fields
- PaymentModule with commission rate database lookup (specificity cascade: category+role > category > role > default), Razorpay order creation for booking checkout, and HMAC signature verification
- RazorpayService extended with createOrder, validatePaymentSignature, and createRefund methods (all with dev mock mode consistent with existing patterns)

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema evolution and shared enums for payment support** - `86dfdb8` (feat)
2. **Task 2: PaymentModule with CommissionService, PaymentService, and PaymentController** - `a3d98ca` (feat)

## Files Created/Modified
- `api/prisma/schema.prisma` - CommissionRate model, modified Transaction (optional vendorSubscriptionId, bookingId, commission/payout fields), Booking payment fields, VendorProfile bank fields
- `packages/shared/src/enums.ts` - PaymentStatus and PayoutStatus enums
- `api/prisma/migrations/20260313000000_phase5_payments_commission/migration.sql` - Migration SQL with default 5% commission rate seed
- `api/src/payment/commission.service.ts` - Commission rate lookup with specificity cascade (86 lines)
- `api/src/payment/payment.service.ts` - createBookingOrder and verifyPayment business logic (159 lines)
- `api/src/payment/payment.controller.ts` - POST /payments/orders and POST /payments/verify endpoints (54 lines)
- `api/src/payment/payment.module.ts` - PaymentModule wiring with SubscriptionModule import for RazorpayService
- `api/src/payment/dto/create-order.dto.ts` - CreateOrderDto with UUID validation
- `api/src/payment/dto/verify-payment.dto.ts` - VerifyPaymentDto with string validation
- `api/src/subscription/razorpay.service.ts` - Extended with createOrder, validatePaymentSignature, createRefund (dev mock mode)
- `api/src/app.module.ts` - Added PaymentModule import

## Decisions Made
- Commission rate locked on Booking at order creation time (Pitfall 4 from research: prevents disputes when rates change between booking and payment)
- verifyPayment does NOT create Transaction record (Pitfall 3: avoids race condition between client callback and webhook; webhook is source of truth)
- Transaction.vendorSubscriptionId changed from required to optional with onDelete SetNull (enables BOOKING_COMMISSION transactions without subscription link; existing subscription webhook code still works since field is still provided)
- RazorpayService stores keySecret as private field for HMAC payment signature validation (orderId|paymentId signed with key_secret)
- Default 500 bps (5%) commission rate seeded as global fallback; more specific category/role rates configurable via admin in Plan 05-03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database not running locally (no .env file) -- schema validated with dummy DATABASE_URL, migration SQL created manually; consistent with Phase 4 pattern where db push was used on live DB and migration marked as applied

## User Setup Required

Razorpay credentials are optional for development (dev mock mode returns placeholder data). For production payment processing:
- `RAZORPAY_KEY_ID` - from Razorpay Dashboard > Settings > API Keys
- `RAZORPAY_KEY_SECRET` - from Razorpay Dashboard > Settings > API Keys

When deploying with a database:
- Run `prisma migrate resolve --applied 20260313000000_phase5_payments_commission` if using db push
- Or run `prisma migrate deploy` to apply migration SQL

## Next Phase Readiness
- PaymentService and CommissionService exported from PaymentModule for use by Plan 05-02 (webhook processing + payouts)
- RazorpayService.createRefund ready for refund processing in Plan 05-02
- Transaction model supports all four revenue types (SUBSCRIPTION, LEAD_PURCHASE, BOOKING_COMMISSION, MARKETPLACE_SALE)
- VendorProfile bank fields ready for RazorpayX Payout API integration in Plan 05-02

## Self-Check: PASSED

| Item | Status |
|------|--------|
| api/src/payment/commission.service.ts | FOUND (86 lines) |
| api/src/payment/payment.service.ts | FOUND (159 lines) |
| api/src/payment/payment.controller.ts | FOUND (54 lines) |
| api/src/payment/payment.module.ts | FOUND |
| api/src/payment/dto/create-order.dto.ts | FOUND |
| api/src/payment/dto/verify-payment.dto.ts | FOUND |
| migration SQL | FOUND |
| Commit 86dfdb8 | FOUND |
| Commit a3d98ca | FOUND |
| commissionService.getRate call | FOUND (1 call) |
| razorpayService references | FOUND (3 refs) |
| prisma.transaction.create in verifyPayment | ABSENT (correct -- webhook is source of truth) |
| model CommissionRate in schema | FOUND |
| PaymentStatus enum | FOUND |
| PayoutStatus enum | FOUND |
| pnpm build | 0 errors |

---
*Phase: 05-payments-and-commission-settlement*
*Completed: 2026-03-13*
