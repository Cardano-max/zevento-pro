# Phase 5: Payments and Commission Settlement - Research

**Researched:** 2026-03-13
**Domain:** Razorpay Orders API, payment webhooks, commission split, vendor payouts (RazorpayX vs Route), refunds, transactions ledger
**Confidence:** HIGH

## Summary

Phase 5 closes the monetary loop: customers pay for confirmed bookings via Razorpay, the platform calculates and retains commission (5-10%, from a rate table), and vendors receive net payouts. The existing codebase already has the `razorpay` SDK v2.9.6 installed, a working `RazorpayService` (with dev mock mode), a `webhook_events` table with unique constraint idempotency, a `Transaction` model with the `TransactionType` enum (SUBSCRIPTION, LEAD_PURCHASE, BOOKING_COMMISSION, MARKETPLACE_SALE), and BullMQ configured globally. The Booking model has `totalPaise` (via Quote). All amounts are already stored in paise.

The primary technical decision in this phase is the commission split and vendor payout mechanism. Two approaches exist: (A) **Razorpay Route** (linked accounts + transfers at payment time) and (B) **RazorpayX Payouts** (platform-initiated bank transfers after capture). Route requires each vendor to be onboarded as a Razorpay linked account with KYC (3-4 day approval per vendor, documents required), which is operationally heavy for an early marketplace. RazorpayX Payouts allows the platform to hold funds in its account and push payouts to vendor bank accounts on its own schedule -- simpler operationally but requires the platform's RazorpayX KYC approval (flagged as a blocker since Phase 2, 2-4 week timeline). **Recommendation: Use RazorpayX Payouts (Composite API) for vendor payouts.** The platform collects full payment, calculates commission, and initiates a payout for the net amount to the vendor's bank account. This avoids per-vendor linked account onboarding overhead and gives the platform full control over payout timing (can hold until booking completion).

**Primary recommendation:** Use Razorpay Orders API for customer checkout, `payment.captured` webhook for confirmation, RazorpayX Composite Payout API for vendor disbursement, and extend the existing `Transaction` model to serve as the unified revenue ledger.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| razorpay | 2.9.6 (already installed) | Orders API, payment capture, refunds, webhook signature verification | Official Razorpay Node SDK; already used for Subscriptions in Phase 2 |
| @nestjs/bullmq | (already installed) | Async payment processing workers, payout job scheduling | Already configured in app.module.ts; proven pattern from Phase 3-4 |
| crypto (Node built-in) | N/A | HMAC SHA256 webhook signature verification (backup) | Already used in RazorpayService.validateWebhookSignature |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-fetch or axios | (already available) | RazorpayX Payouts API calls (not in SDK) | Vendor payout creation -- SDK does not include RazorpayX Payouts |
| class-validator | (already installed) | DTO validation for payment endpoints | Commission rate validation, refund amount validation |
| class-transformer | (already installed) | DTO transformation | Transform request/response DTOs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RazorpayX Payouts | Razorpay Route (linked accounts) | Route requires per-vendor KYC on Razorpay (3-4 day approval each), heavier ops burden; Route is better for large-scale marketplaces with established vendor base |
| Raw HTTP for RazorpayX | razorpayx-nodejs-sdk (unofficial) | Unofficial community SDK with 3 stars on GitHub; not maintained; raw HTTP with proper typing is safer |
| Extending Transaction model | New PaymentLedger table | Unnecessary complexity; Transaction already has the right enum types and is used for SUBSCRIPTION. Extend it for BOOKING_COMMISSION |

**No new installations needed.** The `razorpay` SDK and all supporting libraries are already installed. RazorpayX Payout API calls will use raw HTTP (the official SDK does not include this API).

## Architecture Patterns

### Recommended Module Structure
```
api/src/
  payment/                              # NEW MODULE
    payment.module.ts                   # PaymentModule — imports PrismaModule, SubscriptionModule (for RazorpayService), BullModule, NotificationModule
    payment.controller.ts               # POST /payments/orders (create), POST /payments/verify (client-side verification)
    payment.service.ts                  # Business logic: create order, verify payment, calculate commission
    payout.service.ts                   # RazorpayX Payouts API wrapper — create contact, fund account, payout
    commission.service.ts               # Commission rate lookup, split calculation
    webhook/
      payment-webhook.controller.ts     # POST /webhooks/razorpay/payment — separate from subscription webhook
      payment-webhook.service.ts        # Process payment.captured, payment.failed, refund.processed events
    processor/
      payment.processor.ts             # BullMQ processor: handle captured payments, trigger payout
      payout.processor.ts              # BullMQ processor: execute vendor payout via RazorpayX
    dto/
      create-order.dto.ts              # { bookingId: string }
      verify-payment.dto.ts            # { razorpay_order_id, razorpay_payment_id, razorpay_signature }
      initiate-refund.dto.ts           # { paymentId: string, amount?: number, reason: string }
  admin/
    admin.controller.ts                 # EXTEND: add payment log, refund, commission report endpoints
    admin.service.ts                    # EXTEND: add payment queries, refund initiation
```

### Pattern 1: Razorpay Orders API Payment Flow
**What:** Standard Razorpay checkout flow. Backend creates an order, frontend opens Razorpay Checkout modal, backend verifies payment signature on callback.
**When to use:** Every customer payment for a confirmed booking.

```typescript
// Step 1: Backend creates a Razorpay order
const order = await razorpay.orders.create({
  amount: booking.totalPaise,         // already in paise
  currency: 'INR',
  receipt: `booking_${booking.id}`,   // max 40 chars
  notes: {
    bookingId: booking.id,
    vendorId: booking.vendorId,
    customerId: booking.customerId,
    type: 'BOOKING_COMMISSION',       // tag for webhook routing
  },
});

// Step 2: Frontend uses order.id to open Razorpay Checkout
// (React Native / web — client-side, not backend code)

// Step 3: Backend verifies payment signature after client callback
const generatedSignature = crypto
  .createHmac('sha256', keySecret)
  .update(`${razorpayOrderId}|${razorpayPaymentId}`)
  .digest('hex');
const isValid = generatedSignature === razorpaySignature;
```

### Pattern 2: Commission Rate Table (Database-Driven)
**What:** Commission rates stored in a Prisma model, looked up at payment time. Not hardcoded.
**When to use:** Every commission calculation.

```prisma
model CommissionRate {
  id           String    @id @default(uuid()) @db.Uuid
  categoryId   String?   @map("category_id") @db.Uuid
  vendorRole   String?   @map("vendor_role") @db.VarChar(20)   // PLANNER, SUPPLIER, or null=default
  rateBps      Int       @map("rate_bps")                       // basis points: 500 = 5%, 1000 = 10%
  effectiveFrom DateTime @default(now()) @map("effective_from")
  effectiveTo  DateTime? @map("effective_to")
  createdAt    DateTime  @default(now()) @map("created_at")

  category     EventCategory? @relation(fields: [categoryId], references: [id])

  @@index([categoryId, vendorRole])
  @@map("commission_rates")
}

// Lookup: most specific rate wins
// 1. category + vendorRole (most specific)
// 2. category only
// 3. vendorRole only
// 4. null + null (global default)
```

### Pattern 3: Payment Webhook Idempotency (Reuse Existing Pattern)
**What:** Reuse the existing `webhook_events` table with `provider='RAZORPAY'`, `externalId=paymentId_eventType`, same idempotency pattern as subscription webhooks.
**When to use:** Every payment webhook.

```typescript
// In payment-webhook.service.ts — IDENTICAL pattern to subscription-webhook.service.ts
const externalId = `${paymentId}_${event}`;

try {
  webhookEvent = await this.prisma.webhookEvent.create({
    data: {
      provider: 'RAZORPAY',
      externalId,
      eventType: event,
      status: WebhookEventStatus.RECEIVED,
      payload,
    },
  });
} catch (error: any) {
  if (error?.code === 'P2002') {
    this.logger.log(`Duplicate payment event skipped: ${externalId}`);
    return;  // idempotent — already processed
  }
  throw error;
}
```

### Pattern 4: RazorpayX Composite Payout (Raw HTTP)
**What:** Platform initiates vendor payout via RazorpayX Composite Payout API. Creates contact + fund account + payout in one call. Requires separate API credentials (RAZORPAY_X_KEY_ID, RAZORPAY_X_KEY_SECRET).
**When to use:** After payment is captured and booking is confirmed.

```typescript
// RazorpayX Composite Payout API — raw HTTP call
// Endpoint: POST https://api.razorpay.com/v1/payouts
// Auth: Basic auth with RazorpayX key_id:key_secret
// Headers: X-Payout-Idempotency: unique key (MANDATORY since March 2025)

const payoutResponse = await fetch('https://api.razorpay.com/v1/payouts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${Buffer.from(`${xKeyId}:${xKeySecret}`).toString('base64')}`,
    'X-Payout-Idempotency': `payout_${bookingId}_${paymentId}`,
  },
  body: JSON.stringify({
    account_number: platformAccountNumber,  // Platform's RazorpayX account number
    fund_account: {
      account_type: 'bank_account',
      bank_account: {
        name: vendor.bankAccountName,
        ifsc: vendor.bankIfsc,
        account_number: vendor.bankAccountNumber,
      },
      contact: {
        name: vendor.businessName,
        type: 'vendor',
        email: vendor.user.email,
        contact: vendor.user.phone,
      },
    },
    amount: netPayoutPaise,  // totalPaise - commissionPaise
    currency: 'INR',
    mode: 'IMPS',            // instant; alternatives: NEFT (slower), RTGS (>2L)
    purpose: 'vendor_payout',
    queue_if_low_balance: true,
    reference_id: `booking_${bookingId}`,
    narration: `Zevento payout for booking ${bookingId}`,
  }),
});
```

### Pattern 5: Extending the Transaction Model as Revenue Ledger
**What:** The existing `Transaction` model needs modifications to support booking payment records (not just subscription charges). Currently it has a hard FK to `vendorSubscriptionId` which won't work for booking commission transactions.
**When to use:** Recording any revenue event.

```prisma
// MODIFIED Transaction model — make vendorSubscriptionId optional, add booking link
model Transaction {
  id                   String              @id @default(uuid()) @db.Uuid
  vendorSubscriptionId String?             @map("vendor_subscription_id") @db.Uuid  // nullable now
  bookingId            String?             @map("booking_id") @db.Uuid              // NEW
  type                 String              @db.VarChar(30)                           // TransactionType enum
  amountPaise          Int                 @map("amount_paise")
  commissionPaise      Int?                @map("commission_paise")                  // NEW: platform's cut
  netPayoutPaise       Int?                @map("net_payout_paise")                  // NEW: vendor's cut
  razorpayPaymentId    String?             @unique @map("razorpay_payment_id") @db.VarChar(50)
  razorpayOrderId      String?             @map("razorpay_order_id") @db.VarChar(50) // NEW
  razorpayPayoutId     String?             @map("razorpay_payout_id") @db.VarChar(50) // NEW
  status               String              @db.VarChar(20)
  paidAt               DateTime?           @map("paid_at")
  createdAt            DateTime            @default(now()) @map("created_at")

  vendorSubscription   VendorSubscription? @relation(fields: [vendorSubscriptionId], references: [id], onDelete: Cascade)
  booking              Booking?            @relation(fields: [bookingId], references: [id], onDelete: SetNull)

  @@index([vendorSubscriptionId])
  @@index([bookingId])
  @@index([type])
  @@index([status])
  @@index([createdAt])
  @@map("transactions")
}
```

### Anti-Patterns to Avoid
- **Hardcoding commission rates:** Use a `commission_rates` table with category/role specificity. The requirement explicitly says "5-10% rate from rate table, not hardcoded."
- **Splitting payment at order creation (Route):** Don't use Razorpay Route transfers for this use case. Route requires linked accounts (heavy vendor onboarding). Use "collect full, payout net" pattern instead.
- **Processing payments synchronously in webhook:** Webhook should enqueue a BullMQ job and return 200 immediately. Processing (commission calc, payout trigger, ledger write) happens in the worker.
- **Making vendorSubscriptionId required on Transaction:** The Transaction model must serve all four revenue types. Booking commissions have no subscription link. Make the FK optional.
- **Skipping client-side payment verification:** Even though webhooks are the source of truth, the client callback verification (razorpay_signature) provides immediate UX feedback. Use both.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment checkout flow | Custom card/UPI form | Razorpay Checkout (frontend SDK) + Orders API | PCI-DSS compliance, 3DS authentication, UPI intent handling |
| Payment signature verification | Custom crypto logic | `Razorpay.validateWebhookSignature()` + manual HMAC fallback | Already implemented in RazorpayService; handles encoding edge cases |
| Webhook deduplication | Custom dedup table | Existing `webhook_events` table with unique constraint | Already proven in subscription webhooks; P2002 catch pattern is battle-tested |
| Refund processing | Manual bank reversal | `razorpay.payments.refund()` SDK method | Handles partial refunds, bank-specific reversal flows, refund status tracking |
| Payment retry logic | Custom retry scheduler | Razorpay auto-capture + webhook retry | Razorpay retries webhooks with exponential backoff for up to 24 hours |
| Idempotency for payouts | Custom dedup logic | RazorpayX `X-Payout-Idempotency` header | Mandatory since March 2025; Razorpay deduplicates on their end |

**Key insight:** The payment flow is: Razorpay Orders API (create) -> Razorpay Checkout (frontend) -> payment.captured webhook (backend) -> BullMQ job (commission calc + payout trigger) -> RazorpayX Payout (vendor disbursement). Each step has a battle-tested Razorpay mechanism. The platform code is orchestration glue, not payment logic.

## Common Pitfalls

### Pitfall 1: RazorpayX Payouts API is NOT in the Razorpay Node SDK
**What goes wrong:** Developer tries `razorpay.payouts.create()` and gets undefined.
**Why it happens:** The `razorpay` npm package (v2.9.6) covers the Payment Gateway APIs (orders, payments, transfers, refunds, subscriptions). RazorpayX Payouts is a separate product with a different API (`https://api.razorpay.com/v1/payouts`) that uses the same base URL but different credentials and is NOT included in the SDK.
**How to avoid:** Create a `PayoutService` that makes raw HTTP calls with Basic auth using separate env vars (`RAZORPAY_X_KEY_ID`, `RAZORPAY_X_KEY_SECRET`, `RAZORPAY_X_ACCOUNT_NUMBER`). Include dev mock mode consistent with existing RazorpayService pattern.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'create')` when trying to access a payouts method on the SDK instance.

### Pitfall 2: Webhook Endpoint Collision with Subscription Webhooks
**What goes wrong:** A single `/webhooks/razorpay` endpoint receives both subscription events and payment events, causing event routing confusion.
**Why it happens:** Razorpay sends all configured webhook events to the endpoint(s) you configure in the dashboard. If both subscription and payment events go to the same URL, the handler must discriminate.
**How to avoid:** Two approaches: (A) Configure separate webhook URLs in Razorpay dashboard (`/webhooks/razorpay/subscription` and `/webhooks/razorpay/payment`) -- each receives only its event types. (B) Use a single URL with event-type routing. **Recommendation: Approach A** -- the subscription webhook controller already uses `/webhooks/razorpay/subscription`. Create `/webhooks/razorpay/payment` for payment events. Configure each URL in Razorpay dashboard with only the relevant event types.
**Warning signs:** Subscription webhook handler logging "Unknown event type: payment.captured".

### Pitfall 3: Race Between Client Verification and Webhook
**What goes wrong:** Client-side `POST /payments/verify` arrives before the `payment.captured` webhook, or vice versa. If verify creates the transaction record, the webhook creates a duplicate. If webhook creates first, verify finds an already-processed payment and returns confusing errors.
**How to avoid:** Use the `webhook_events` idempotency table as the single source of truth. The client verification endpoint should: (1) verify the signature, (2) update the booking status optimistically for UX, (3) NOT create the Transaction record. The webhook handler creates the Transaction record in BullMQ. If the webhook fires first (common), verify just confirms what webhook already did.
**Warning signs:** Duplicate transaction entries or booking stuck in "payment pending" state.

### Pitfall 4: Commission Calculation Timing
**What goes wrong:** Commission rate changes between booking creation and payment, causing disputes.
**Why it happens:** Rate looked up at payment time, not booking time. Or: rate looked up at booking time but payment happens weeks later after a rate change.
**How to avoid:** Lock the commission rate at booking creation time. Store `commissionRateBps` on the Booking or a BookingPayment record at the moment the quote is accepted. Use this locked rate when processing the payment, not the current rate table value.
**Warning signs:** Admin changes commission rate and existing unpaid bookings are charged the new rate.

### Pitfall 5: Payout Before Booking Completion
**What goes wrong:** Vendor receives payout, then the booking is cancelled or disputed.
**Why it happens:** Payout triggered immediately on payment capture, before the event has actually occurred.
**How to avoid:** Hold payout until booking status reaches COMPLETED (or a configurable hold period). Use BullMQ delayed jobs to schedule payout after a cooling period (e.g., 24-48 hours post-completion). This also allows time for dispute/refund requests.
**Warning signs:** Customer requests refund but vendor has already been paid out; platform must eat the cost.

### Pitfall 6: Missing VendorProfile Bank Details
**What goes wrong:** Payment is captured, commission is calculated, but payout fails because vendor has no bank account details in the system.
**Why it happens:** Bank account fields (`bankAccountNumber`, `bankIfsc`, `bankAccountName`) don't exist on VendorProfile yet. They need to be added in this phase's schema migration.
**How to avoid:** Add bank detail fields to VendorProfile in the Prisma schema. Require bank details before a vendor can receive bookings, OR queue payouts with status PENDING_BANK_DETAILS and notify the vendor to add their bank info. The payout processor retries when details are available.
**Warning signs:** Payout jobs stuck in failed state with "bank details missing" errors.

### Pitfall 7: RazorpayX Payout Idempotency Key is Mandatory
**What goes wrong:** Payout API returns 400 error.
**Why it happens:** Since March 15, 2025, the `X-Payout-Idempotency` header is mandatory for all payout requests. Missing it causes rejection.
**How to avoid:** Always include `X-Payout-Idempotency: payout_{bookingId}_{paymentId}` header. This also protects against duplicate payouts if a BullMQ job retries.
**Warning signs:** 400 Bad Request responses from the payouts endpoint with "idempotency key required" message.

## Code Examples

### Razorpay Order Creation for Booking Payment
```typescript
// Source: Razorpay Orders API + SDK types from node_modules/razorpay
// PaymentService.createBookingOrder()

async createBookingOrder(bookingId: string, userId: string) {
  const booking = await this.prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      quote: true,
      vendor: { select: { id: true, businessName: true } },
    },
  });

  if (!booking || booking.customerId !== userId) {
    throw new NotFoundException('Booking not found');
  }
  if (booking.status !== 'BOOKED') {
    throw new BadRequestException('Booking is not in payable state');
  }

  // Lock commission rate at order creation
  const commissionRateBps = await this.commissionService.getRate(
    booking.vendor.id,
    booking.quote.categoryId,
  );

  const order = await this.razorpayService.createOrder({
    amount: booking.quote.totalPaise,
    currency: 'INR',
    receipt: `bkg_${booking.id.substring(0, 30)}`, // max 40 chars
    notes: {
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerId: booking.customerId,
      type: 'BOOKING_COMMISSION',
      commissionRateBps: String(commissionRateBps),
    },
  });

  // Store order reference on booking (or separate PaymentOrder table)
  await this.prisma.booking.update({
    where: { id: bookingId },
    data: { razorpayOrderId: order.id },
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
}
```

### Payment Verification (Client Callback)
```typescript
// Source: Razorpay Payment Verification docs
// PaymentService.verifyPayment()

async verifyPayment(dto: VerifyPaymentDto) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

  // HMAC SHA256 verification: order_id|payment_id signed with key_secret
  const isValid = this.razorpayService.validatePaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  if (!isValid) {
    throw new UnauthorizedException('Invalid payment signature');
  }

  // Optimistic booking update for UX (webhook is source of truth)
  const booking = await this.prisma.booking.findFirst({
    where: { razorpayOrderId: razorpay_order_id },
  });

  if (booking) {
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: 'CAPTURED' },
    });
  }

  return { status: 'ok', paymentId: razorpay_payment_id };
}
```

### Commission Rate Lookup
```typescript
// CommissionService.getRate()
// Specificity cascade: category+role > category > role > default

async getRate(vendorId: string, categoryId?: string): Promise<number> {
  const vendor = await this.prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { role: true },
  });
  const now = new Date();

  // Try most specific first, fall back to less specific
  const rate = await this.prisma.commissionRate.findFirst({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      OR: [
        // Most specific: category + role
        { categoryId, vendorRole: vendor?.role },
        // Category only
        { categoryId, vendorRole: null },
        // Role only
        { categoryId: null, vendorRole: vendor?.role },
        // Global default
        { categoryId: null, vendorRole: null },
      ],
    },
    orderBy: [
      { categoryId: { sort: 'desc', nulls: 'last' } },
      { vendorRole: { sort: 'desc', nulls: 'last' } },
    ],
  });

  if (!rate) {
    throw new Error('No commission rate configured');
  }

  return rate.rateBps; // basis points: 500 = 5%
}
```

### Webhook Payment Event Processing
```typescript
// Payment webhook events to handle:
// - payment.captured  -> process commission, record transaction, queue payout
// - payment.failed    -> mark booking payment as failed, notify customer
// - refund.processed  -> update transaction status, reverse payout if needed
// - order.paid        -> alternative to payment.captured (same net effect)

// In payment-webhook.service.ts
async processPaymentCaptured(paymentEntity: any, orderNotes: any) {
  const { bookingId, vendorId, commissionRateBps } = orderNotes;

  const totalPaise = paymentEntity.amount;
  const commissionPaise = Math.round(
    (totalPaise * parseInt(commissionRateBps)) / 10000,
  );
  const netPayoutPaise = totalPaise - commissionPaise;

  // Record in transactions ledger
  await this.prisma.transaction.create({
    data: {
      bookingId,
      type: TransactionType.BOOKING_COMMISSION,
      amountPaise: totalPaise,
      commissionPaise,
      netPayoutPaise,
      razorpayPaymentId: paymentEntity.id,
      razorpayOrderId: paymentEntity.order_id,
      status: TransactionStatus.PAID,
      paidAt: new Date(),
    },
  });

  // Queue vendor payout (delayed: wait for booking completion or hold period)
  await this.payoutQueue.add('vendor-payout', {
    bookingId,
    vendorId,
    netPayoutPaise,
    razorpayPaymentId: paymentEntity.id,
  }, {
    delay: 0,  // or configurable hold period
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
  });
}
```

## Prisma Schema Additions

### New Models and Modifications Required

```prisma
// ──────────────────────────────────────────────────
// Phase 5: Payments and Commission Settlement
// ──────────────────────────────────────────────────

// NEW: Commission rate table (not hardcoded)
model CommissionRate {
  id            String         @id @default(uuid()) @db.Uuid
  categoryId    String?        @map("category_id") @db.Uuid
  vendorRole    String?        @map("vendor_role") @db.VarChar(20)
  rateBps       Int            @map("rate_bps")              // 500 = 5%, 1000 = 10%
  effectiveFrom DateTime       @default(now()) @map("effective_from")
  effectiveTo   DateTime?      @map("effective_to")
  createdAt     DateTime       @default(now()) @map("created_at")

  category      EventCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([categoryId, vendorRole])
  @@map("commission_rates")
}

// MODIFIED: VendorProfile — add bank account fields for payout
// Add to existing VendorProfile model:
//   bankAccountName   String?  @map("bank_account_name") @db.VarChar(200)
//   bankAccountNumber String?  @map("bank_account_number") @db.VarChar(30)
//   bankIfsc          String?  @map("bank_ifsc") @db.VarChar(11)

// MODIFIED: Booking — add payment tracking fields
// Add to existing Booking model:
//   razorpayOrderId   String?  @map("razorpay_order_id") @db.VarChar(50)
//   paymentStatus     String?  @map("payment_status") @db.VarChar(20)  // PENDING, CAPTURED, FAILED, REFUNDED
//   commissionRateBps Int?     @map("commission_rate_bps")             // locked at booking/order time

// MODIFIED: Transaction — generalize from subscription-only to all revenue types
// Changes to existing Transaction model:
//   vendorSubscriptionId  -> make OPTIONAL (String?)
//   + bookingId           String?  @map("booking_id") @db.Uuid
//   + commissionPaise     Int?     @map("commission_paise")
//   + netPayoutPaise      Int?     @map("net_payout_paise")
//   + razorpayOrderId     String?  @map("razorpay_order_id") @db.VarChar(50)
//   + razorpayPayoutId    String?  @map("razorpay_payout_id") @db.VarChar(50)
//   + payoutStatus        String?  @map("payout_status") @db.VarChar(20)
//   + booking relation    Booking? @relation(...)
//   + indexes on [bookingId], [type], [status], [createdAt]
```

### Enum Additions (shared package)
```typescript
// Add to packages/shared/src/enums.ts

export enum PaymentStatus {
  PENDING = 'PENDING',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  REVERSED = 'REVERSED',
  FAILED = 'FAILED',
  PENDING_BANK_DETAILS = 'PENDING_BANK_DETAILS',
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Razorpay Route for marketplace splits | RazorpayX Payouts for direct vendor disbursement | RazorpayX matured 2023-2024 | Simpler ops: no per-vendor linked account KYC; platform controls payout timing |
| Optional idempotency on payouts | Mandatory `X-Payout-Idempotency` header | March 15, 2025 | Must include header on every payout API call or receive 400 error |
| Manual payment capture | Auto-capture on order creation | Stable (configurable) | Use auto-capture for marketplace payments; set `payment.capture = 'automatic'` on order |
| Polling payment status | Webhook-driven status updates | Standard since 2020 | Subscribe to `payment.captured`, `payment.failed`, `refund.processed` events |

**Deprecated/outdated:**
- Using `razorpay-typescript` (unofficial) -- use official `razorpay` npm which includes types
- Using Route transfers for marketplace payouts when vendors are not Razorpay merchants -- use RazorpayX Payouts instead
- Skipping idempotency headers on payouts -- mandatory since March 2025

## Open Questions

1. **RazorpayX KYC Approval Status**
   - What we know: Application was flagged as a blocker in Phase 2 (submit during Phase 2, 2-4 week approval). The roadmap says "Razorpay Payout KYC application must be submitted during Phase 2."
   - What's unclear: Has the KYC application actually been submitted? Is it approved?
   - Recommendation: The payout code should be built with a dev mock mode (same pattern as existing RazorpayService). If RazorpayX is not approved yet, all payout features work in mock mode. Flag as ops verification before going live.

2. **Payout Timing: Immediate vs Post-Completion**
   - What we know: Paying vendors immediately on payment capture is risky (booking might be cancelled). Holding until COMPLETED is safer but delays vendor cash flow.
   - What's unclear: Business decision on acceptable hold period.
   - Recommendation: Default to payout on booking COMPLETED status transition. Add a configurable hold period (default: 0 hours post-completion). This can be adjusted operationally without code changes. Record `payoutEligibleAt` timestamp on the transaction.

3. **GST on Commission**
   - What we know: Platform commission is a service fee. In India, service fees attract 18% GST. The commission amount displayed to vendors should show the GST component.
   - What's unclear: Whether GST is included in the commission rate (5-10% is inclusive of GST) or added on top (5% commission + 18% GST on that 5%).
   - Recommendation: For MVP, treat the commission rate as GST-inclusive. Store commission amount in paise as-is. GST breakup is a display concern (commission / 1.18 = base, remainder = GST). Flag for finance/legal review before launch.

4. **Partial Payments and Advance Deposits**
   - What we know: Success criteria says "customer can pay for a confirmed booking." This implies full payment.
   - What's unclear: Will vendors require advance deposits (e.g., 50% upfront, 50% post-event)?
   - Recommendation: Build for full payment only in Phase 5. Partial payment support can be added later by splitting into multiple Razorpay orders against the same booking. The schema supports this (Transaction has bookingId, not orderId as the unique link).

## Sources

### Primary (HIGH confidence)
- Razorpay Node SDK v2.9.6 types (verified from `node_modules/.pnpm/razorpay@2.9.6/`) -- Orders, Payments, Refunds, Transfers type definitions
- Existing codebase: `RazorpayService`, `SubscriptionWebhookService`, `Transaction` model, `webhook_events` table, `BullModule` configuration
- [Razorpay Orders API docs](https://razorpay.com/docs/api/orders/) -- order creation, payment flow
- [Razorpay Payment Webhook Events](https://razorpay.com/docs/webhooks/payments/) -- payment.authorized, payment.captured, payment.failed
- [Razorpay Refunds API](https://razorpay.com/docs/api/refunds/) -- create refund, fetch refund status

### Secondary (MEDIUM confidence)
- [RazorpayX Payouts API](https://razorpay.com/docs/api/x/payouts/) -- payout creation, fund accounts, composite API
- [RazorpayX Composite Payout API](https://razorpay.com/docs/api/x/payout-composite/create/bank-account/) -- single-call contact+fund_account+payout creation
- [Razorpay Route docs](https://razorpay.com/docs/payments/route/) -- evaluated and rejected for this use case (linked account KYC overhead)
- [RazorpayX Payout Idempotency](https://razorpay.com/docs/x/payouts/best-practices/) -- mandatory idempotency key since March 2025

### Tertiary (LOW confidence)
- [razorpayx-nodejs-sdk (unofficial)](https://github.com/sonu247/razorpayx-nodejs-sdk) -- community SDK, 3 GitHub stars, not recommended for production use
- GST handling on marketplace commission -- needs finance/legal verification for specific implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using existing installed SDK; no new libraries needed
- Architecture: HIGH -- follows established codebase patterns (webhook idempotency, BullMQ workers, dev mock mode)
- Razorpay Orders/Payments: HIGH -- SDK types verified in node_modules, patterns proven in subscription flow
- RazorpayX Payouts: MEDIUM -- API documented but not in SDK; requires raw HTTP calls; idempotency requirement verified
- Commission rate table: HIGH -- standard database-driven pattern; requirement explicitly says "not hardcoded"
- Transaction model evolution: HIGH -- existing model + enum provide the foundation; modifications are additive
- Payout timing/GST: LOW -- business decisions needed; recommendations provided but need stakeholder input

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days -- stable domain, Razorpay API is versioned and backward-compatible)
