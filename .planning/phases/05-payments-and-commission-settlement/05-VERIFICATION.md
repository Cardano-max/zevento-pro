---
phase: 05-payments-and-commission-settlement
verified: 2026-03-13T18:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 5: Payments and Commission Settlement Verification Report

**Phase Goal:** Customer payments flow through Razorpay, the platform captures commission automatically, vendor payouts are disbursed after deduction, and all four revenue streams are recorded in an isolated transactions ledger
**Verified:** 2026-03-13T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Customer can pay for a confirmed booking via Razorpay (UPI, card, netbanking) from the booking detail page | VERIFIED | `PaymentController` exposes `POST /payments/orders` (CUSTOMER role guard) which calls `PaymentService.createBookingOrder`. Service validates booking exists, belongs to customer, status is BOOKED, creates Razorpay order via `RazorpayService.createOrder`, returns `{orderId, amount, currency, keyId}` for client Razorpay Checkout. `POST /payments/verify` validates payment signature via HMAC SHA256. |
| 2 | Platform commission (5-10% rate from rate table, not hardcoded) is calculated and split automatically at payment capture; vendor receives net payout via Razorpay Payouts | VERIFIED | `CommissionService.getRate()` queries `CommissionRate` table with specificity cascade (category+role > category > role > global default). Rate is locked on booking at order creation (`commissionRateBps`). `PaymentProcessor` calculates split: `commissionPaise = Math.round((totalPaise * commissionRateBps) / 10000)`, `netPayoutPaise = totalPaise - commissionPaise`. Creates `BOOKING_COMMISSION` Transaction. `BookingService.transitionStatus` triggers `vendor-payout` BullMQ job on COMPLETED. `PayoutProcessor` calls `PayoutService.createPayout` which uses RazorpayX Composite Payout API with `X-Payout-Idempotency` header. |
| 3 | Duplicate webhook events are detected and rejected using a unique constraint on (payment_id, event_type) — the same payment is never processed twice | VERIFIED | `PaymentWebhookService.handleWebhook()` builds idempotency key as `${paymentEntity.id}_${event}` and inserts into `webhook_events` table (which has `@@unique([provider, externalId, eventType])`). P2002 catch on line 83 silently returns for duplicates: `if (error?.code === 'P2002') { this.logger.log('Duplicate payment event skipped...'); return; }`. |
| 4 | Admin can view the full payment log filterable by date, vendor, and transaction type, and can initiate refunds for disputed bookings | VERIFIED | `AdminController` exposes: `GET /admin/payments` (date range, vendorId, type filters), `POST /admin/payments/refund`, `GET /admin/payments/reconciliation`. All protected by `JwtAuthGuard + RolesGuard('ADMIN')`. `AdminService.getPaymentLog()` builds Prisma where clause with date range (`gte`/`lte`), vendorId (via `OR: [{booking.vendorId}, {vendorSubscription.vendorId}]`), and type filter. `initiateRefund()` validates transaction is BOOKING_COMMISSION + PAID, calls `razorpayService.createRefund()`, updates both Transaction and Booking status to REFUNDED. |
| 5 | All revenue transactions are recorded in a typed ledger (SUBSCRIPTION, LEAD_PURCHASE, BOOKING_COMMISSION, MARKETPLACE_SALE) enabling per-stream revenue reporting | VERIFIED | `TransactionType` enum in `packages/shared/src/enums.ts` defines all four types. `Transaction` model has `type @db.VarChar(30)` field. `AdminService.getReconciliation()` uses `prisma.transaction.groupBy({ by: ['type'], _sum: { amountPaise, commissionPaise, netPayoutPaise }, _count: true, where: { status: 'PAID' } })` for per-stream revenue reporting. Payout breakdown also aggregated by `payoutStatus`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/prisma/schema.prisma` | CommissionRate model, modified Transaction/Booking/VendorProfile | VERIFIED | CommissionRate at line 504 with categoryId, vendorRole, rateBps, effectiveFrom, effectiveTo. Transaction has optional vendorSubscriptionId, bookingId, commissionPaise, netPayoutPaise, razorpayOrderId, razorpayPayoutId, payoutStatus. Booking has razorpayOrderId, paymentStatus, commissionRateBps. VendorProfile has bankAccountName, bankAccountNumber, bankIfsc. |
| `packages/shared/src/enums.ts` | PaymentStatus and PayoutStatus enums | VERIFIED | PaymentStatus (PENDING, CAPTURED, FAILED, REFUNDED) at line 110. PayoutStatus (PENDING, QUEUED, PROCESSING, PROCESSED, REVERSED, FAILED, PENDING_BANK_DETAILS) at line 117. |
| `api/src/payment/commission.service.ts` | Specificity cascade rate lookup (min 40 lines) | VERIFIED | 86 lines. Queries vendorProfile for role, builds OR conditions for specificity cascade, orderBy categoryId DESC NULLS LAST + vendorRole DESC NULLS LAST. Throws InternalServerErrorException if no rate found. |
| `api/src/payment/payment.service.ts` | createBookingOrder and verifyPayment (min 80 lines) | VERIFIED | 159 lines. createBookingOrder validates ownership/status, calls CommissionService.getRate, creates Razorpay order, locks commissionRateBps on booking. verifyPayment validates HMAC signature, optimistically updates booking (does NOT create Transaction). |
| `api/src/payment/payment.controller.ts` | POST /payments/orders and POST /payments/verify | VERIFIED | 54 lines. Both endpoints guarded by JwtAuthGuard + RolesGuard, @Roles('CUSTOMER'). |
| `api/src/payment/payment.module.ts` | PaymentModule with SubscriptionModule import | VERIFIED | Imports SubscriptionModule + BullModule (payment-processing, vendor-payout). Providers: CommissionService, PaymentService, PaymentWebhookService, PaymentProcessor, PayoutProcessor, PayoutService. Exports: PaymentService, CommissionService, PayoutService. |
| `api/src/payment/webhook/payment-webhook.controller.ts` | POST /webhooks/razorpay/payment public endpoint | VERIFIED | 55 lines. No auth guards (public). Reads rawBody, passes to service, always returns 200 (catches errors). Re-throws 401 for signature failures. |
| `api/src/payment/webhook/payment-webhook.service.ts` | Idempotency via webhook_events, BullMQ enqueueing | VERIFIED | 229 lines. Signature verification, P2002 idempotency, routes payment.captured (BullMQ), payment.failed (direct booking update), refund.processed (Transaction + Booking update). |
| `api/src/payment/processor/payment.processor.ts` | Commission split, Transaction creation | VERIFIED | 130 lines. @Processor('payment-processing'). Finds booking by orderId, uses locked rate (fallback to CommissionService), calculates commission split, creates BOOKING_COMMISSION Transaction, updates booking paymentStatus, marks webhookEvent PROCESSED. |
| `api/src/payment/processor/payout.processor.ts` | Vendor payout on COMPLETED | VERIFIED | 104 lines. @Processor('vendor-payout'). Verifies booking is COMPLETED (throws to retry if not), calls PayoutService.createPayout, updates Transaction with payoutId and payoutStatus. |
| `api/src/payment/payout.service.ts` | RazorpayX Composite Payout with dev mock | VERIFIED | 159 lines. Dev mock mode when RAZORPAY_X_KEY_ID not set. Checks bank details (returns PENDING_BANK_DETAILS without throwing). Real mode: raw HTTP to api.razorpay.com/v1/payouts with Basic auth and X-Payout-Idempotency header. |
| `api/src/booking/booking.service.ts` | Payout trigger on COMPLETED | VERIFIED | @InjectQueue('vendor-payout') present. After transitionStatus completes COMPLETED transition, finds BOOKING_COMMISSION transaction and enqueues vendor-payout job with 5 attempts and exponential backoff (60s). |
| `api/src/admin/admin.service.ts` | Payment log, refund, reconciliation, commission CRUD | VERIFIED | getPaymentLog (date/vendor/type filters, pagination), initiateRefund (validates BOOKING_COMMISSION + PAID, calls razorpayService.createRefund), getReconciliation (groupBy type + payoutStatus), createCommissionRate (validates categoryId), updateCommissionRate, listCommissionRates, deleteCommissionRate (soft-delete via effectiveTo). |
| `api/src/admin/admin.controller.ts` | Admin payment endpoints | VERIFIED | GET /admin/payments, POST /admin/payments/refund, GET /admin/payments/reconciliation, POST/PATCH/GET/DELETE /admin/commission-rates. All under class-level @Roles('ADMIN'). |
| `api/src/admin/dto/initiate-refund.dto.ts` | Refund DTO | VERIFIED | transactionId (UUID), optional amountPaise (positive), reason (string, max 500). |
| `api/src/admin/dto/manage-commission.dto.ts` | Commission rate DTOs | VERIFIED | CreateCommissionRateDto: optional categoryId, vendorRole (PLANNER/SUPPLIER), rateBps (100-3000), optional effectiveFrom/To. UpdateCommissionRateDto: optional rateBps (100-3000), effectiveTo. |
| `api/src/subscription/razorpay.service.ts` | createOrder, validatePaymentSignature, createRefund | VERIFIED | createOrder (line 147, dev mock + real SDK), validatePaymentSignature (line 173, HMAC SHA256), createRefund (line 190, dev mock + real SDK). keySecret stored as private field. |
| `api/src/app.module.ts` | PaymentModule imported | VERIFIED | PaymentModule imported at line 12, listed in imports at line 73. |
| `api/src/admin/admin.module.ts` | SubscriptionModule import for RazorpayService | VERIFIED | Imports PrismaModule, AuthModule, SubscriptionModule. |
| `api/src/booking/booking.module.ts` | BullModule vendor-payout queue registered | VERIFIED | BullModule.registerQueue({ name: 'vendor-payout' }) at line 24. |
| `api/prisma/migrations/20260313000000_phase5_payments_commission/migration.sql` | Schema migration with seed | VERIFIED | Creates commission_rates table, alters transactions (optional vendor_subscription_id, new columns), alters bookings (payment fields), alters vendor_profiles (bank fields), adds indexes, adds FKs, seeds 500 bps default rate. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `payment.service.ts` | `razorpay.service.ts` | RazorpayService injection | WIRED | Constructor injects `RazorpayService`, calls `createOrder()` at line 79 and `validatePaymentSignature()` at line 127. |
| `payment.service.ts` | `commission.service.ts` | CommissionService.getRate | WIRED | Constructor injects `CommissionService`, calls `getRate()` at line 73. |
| `payment.controller.ts` | `payment.service.ts` | PaymentService injection | WIRED | Calls `createBookingOrder()` at line 41 and `verifyPayment()` at line 52. |
| `payment.service.ts` | `prisma.booking` | Booking lookup/update | WIRED | `findUnique` at line 43, `update` at line 93 with razorpayOrderId + commissionRateBps. |
| `payment-webhook.controller.ts` | `payment-webhook.service.ts` | handleWebhook | WIRED | Calls `paymentWebhookService.handleWebhook(rawBody, signature)` at line 42. |
| `payment-webhook.service.ts` | `prisma.webhookEvent.create` | P2002 idempotency | WIRED | `webhookEvent.create` at line 73, `P2002` catch at line 83. |
| `payment-webhook.service.ts` | `payment-processing queue` | BullMQ add | WIRED | `paymentQueue.add('payment-captured', ...)` at line 134 with 3 attempts + exponential backoff. |
| `payment.processor.ts` | `prisma.transaction.create` | Transaction ledger entry | WIRED | `transaction.create` at line 89 with BOOKING_COMMISSION type, commissionPaise, netPayoutPaise. |
| `payout.processor.ts` | `payout.service.ts` | PayoutService.createPayout | WIRED | `payoutService.createPayout(...)` at line 70. |
| `payout.service.ts` | RazorpayX API | HTTP fetch with X-Payout-Idempotency | WIRED | `fetch('https://api.razorpay.com/v1/payouts', ...)` at line 104 with `X-Payout-Idempotency` header at line 109. |
| `booking.service.ts` | `vendor-payout queue` | BullMQ on COMPLETED | WIRED | `payoutQueue.add('vendor-payout', ...)` at line 157, only when `dto.status === 'COMPLETED'` at line 148. Finds BOOKING_COMMISSION transaction first. |
| `admin.service.ts` | `prisma.transaction.findMany` | Payment log filters | WIRED | `transaction.findMany` at line 635 with date/vendor/type where clause. |
| `admin.service.ts` | `razorpayService.createRefund` | Admin refund | WIRED | `razorpayService.createRefund(transaction.razorpayPaymentId, ...)` at line 711. |
| `admin.service.ts` | `prisma.commissionRate` | CRUD operations | WIRED | `create` at line 781, `update` at line 811, `findMany` at line 825, soft-delete `update` at line 849. |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| PAY-01: Customer can pay via Razorpay (UPI, cards, netbanking) | SATISFIED | None — order creation + signature verification implemented |
| PAY-02: Platform processes commission split automatically | SATISFIED | None — CommissionService + PaymentProcessor calculate and record split |
| PAY-03: Vendor receives payout after commission deduction | SATISFIED | None — PayoutService with RazorpayX, triggered on booking COMPLETED |
| PAY-04: Razorpay webhook processing with idempotency | SATISFIED | None — P2002 unique constraint on webhook_events |
| PAY-05: Admin can view payment logs and initiate refunds | SATISFIED | None — GET /admin/payments with filters, POST /admin/payments/refund |
| SUBS-04: Booking commission 5-10% | SATISFIED | None — CommissionRate table with admin CRUD, default 5% seeded |
| SUBS-05: B2B product margin | PARTIALLY SATISFIED | MARKETPLACE_SALE type exists in enum but Phase 6 (product marketplace) not yet implemented |
| ADMIN-07: Admin can view payment logs, commissions, initiate refunds | SATISFIED | None — Full payment management + reconciliation + commission rate CRUD |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No TODO, FIXME, placeholder, empty implementation, or stub patterns detected in any Phase 5 files |

### Human Verification Required

### 1. Payment Checkout Flow End-to-End

**Test:** Create a BOOKED booking, call POST /payments/orders, use returned orderId with Razorpay Checkout SDK, complete payment, verify POST /payments/verify returns success.
**Expected:** Booking paymentStatus transitions from null -> PENDING -> CAPTURED. Transaction record created with correct commission split.
**Why human:** Requires running server with Razorpay test credentials and actual SDK interaction.

### 2. Webhook Idempotency Under Load

**Test:** Send the same payment.captured webhook event twice rapidly. Check only one Transaction record is created.
**Expected:** First request creates webhookEvent + enqueues job. Second request hits P2002 and returns silently. Only one Transaction exists.
**Why human:** Requires simulating concurrent webhook delivery.

### 3. Payout Trigger on Booking Completion

**Test:** Complete a booking that has a CAPTURED payment. Verify vendor-payout BullMQ job is enqueued and PayoutService is called.
**Expected:** Transaction updated with razorpayPayoutId and payoutStatus. In dev mode, mock payout logged.
**Why human:** Requires running BullMQ workers and transitioning booking through full lifecycle.

### 4. Admin Refund Flow

**Test:** As admin, call POST /admin/payments/refund with a valid transactionId. Verify Razorpay refund is initiated and statuses updated.
**Expected:** Transaction status -> REFUNDED, Booking paymentStatus -> REFUNDED, Razorpay refund mock returned.
**Why human:** Requires admin JWT token and running server.

### Gaps Summary

No gaps found. All five observable truths are verified. All artifacts exist, are substantive (no stubs), and are properly wired. All key links between components are connected. All Phase 5 requirements (PAY-01 through PAY-05, SUBS-04, ADMIN-07) are satisfied. SUBS-05 (B2B product margin) has the transaction type ready but depends on Phase 6 for full implementation, which is expected.

The implementation follows the planned architecture exactly:
- Customer payment flow: Controller -> Service -> RazorpayService -> Prisma (order creation + rate locking)
- Webhook flow: Controller -> Service (idempotency) -> BullMQ -> Processor (commission split + Transaction)
- Payout flow: BookingService (COMPLETED trigger) -> BullMQ -> PayoutProcessor -> PayoutService -> RazorpayX API
- Admin flow: Controller -> Service -> Prisma (filters, refund via RazorpayService, groupBy reconciliation, CRUD)

---

_Verified: 2026-03-13T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
