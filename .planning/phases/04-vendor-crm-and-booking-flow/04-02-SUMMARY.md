---
phase: 04-vendor-crm-and-booking-flow
plan: "02"
subsystem: quote
tags: [quote, booking, bullmq, state-machine, prisma-transaction, vendor, customer]
dependency_graph:
  requires:
    - "04-01: Phase 4 Prisma schema — Quote, QuoteLineItem, Booking, BookingStatusHistory models"
    - "02-01: VendorProfile model with VendorStats.totalLeadsWon"
    - "01-02: JwtAuthGuard, RolesGuard, JwtPayload interface"
    - "02-01: VendorOwnerGuard attaches req.vendorId from JWT userId"
    - "03-03: BullModule.forRoot registered in AppModule (BullMQ infrastructure)"
  provides:
    - "POST /leads/:leadId/quotes — vendor creates/updates DRAFT quote with line items"
    - "PATCH /quotes/:id/submit — vendor submits DRAFT→SUBMITTED, enqueues BullMQ expiry job"
    - "GET /leads/:leadId/quotes — customer comparison view of SUBMITTED quotes"
    - "POST /quotes/:id/accept — customer accepts quote: atomic Booking creation + lead status BOOKED"
    - "QuoteExpiryProcessor — idempotent BullMQ worker: SUBMITTED→EXPIRED if not already ACCEPTED"
    - "QuoteService — exported for use by 04-03 if needed"
  affects:
    - "04-03: BookingModule builds on Booking records created here"
    - "Lead.status transitions: PENDING→QUOTES_RECEIVED (first submit), →BOOKED (acceptance)"
    - "VendorStats.totalLeadsWon: increments on each booking creation"
tech_stack:
  added: []
  patterns:
    - "Prisma $transaction for atomic state transitions (updateMany with status filter — TOCTOU-safe)"
    - "BullMQ delayed job for quote expiry: delay = validUntil.getTime() - Date.now()"
    - "VendorStats incremented outside $transaction to avoid long-running TX (pitfall 4)"
    - "Idempotent expiry: updateMany where status=SUBMITTED (no-op if already ACCEPTED)"
    - "totalPaise computed server-side from lineItems DTO (not trusted from client)"
    - "VendorOwnerGuard reused for vendor endpoints (resolves req.vendorId from JWT userId)"
key_files:
  created:
    - api/src/quote/quote.service.ts
    - api/src/quote/quote.processor.ts
    - api/src/quote/quote.module.ts
    - api/src/quote/quote.controller.ts
    - api/src/quote/dto/create-quote.dto.ts
    - api/src/quote/dto/accept-quote.dto.ts
  modified:
    - api/src/app.module.ts
decisions:
  - "[04-02]: totalPaise computed server-side from lineItems (not accepted from client) — prevents price manipulation"
  - "[04-02]: VendorStats.totalLeadsWon incremented outside $transaction — consistent with pitfall 4 (Redis cache) pattern from 04-01"
  - "[04-02]: QuoteController uses @Controller() with full paths (leads/:leadId/quotes, quotes/:id/accept) — avoids nested controller routing complexity"
  - "[04-02]: submitQuote checks submittedCount excluding current quote (not before update) — correct QUOTES_RECEIVED detection post-transition"
metrics:
  duration_seconds: 813
  tasks_completed: 2
  files_created: 6
  files_modified: 1
  completed_date: "2026-03-08"
---

# Phase 4 Plan 02: Quote Module with State Machine, BullMQ Expiry, and Booking Creation — Summary

**One-liner:** Full quote lifecycle — vendor DRAFT/SUBMIT with BullMQ delayed expiry, customer atomic accept that creates Booking inside Prisma $transaction with Lead.status→BOOKED and VendorStats.totalLeadsWon++.

## What Was Built

### Task 1: QuoteService, QuoteExpiryProcessor, QuoteModule (commit 1833b0b)

**QuoteService** (`quote.service.ts`, 317 lines):

- `createOrUpdateQuote(leadId, vendorId, dto)`: Checks for existing quote via compound unique `leadId_vendorId`. If DRAFT exists: deletes line items and rebuilds in `$transaction`. If any other status: throws `BadRequestException`. If no quote: creates fresh DRAFT. `totalPaise` computed server-side as `sum(amountPaise * quantity)`.
- `submitQuote(quoteId, vendorId)`: Atomic `updateMany where { id, vendorId, status: 'DRAFT' }` (TOCTOU-safe). Fetches updated quote. Checks `submittedCount` of other SUBMITTED quotes for same lead — if 0, updates Lead.status to `QUOTES_RECEIVED`. Outside TX: enqueues BullMQ delayed job with `delay = Math.max(0, validUntil - now)`, 3 attempts, exponential backoff.
- `acceptQuote(quoteId, customerId)`: Full `$transaction`: (1) `updateMany where { id, status: 'SUBMITTED' }` → ACCEPTED, (2) fetch quote with lead, (3) verify `lead.customerId === customerId`, (4) reject other SUBMITTED quotes, (5) `tx.booking.create`, (6) `tx.bookingStatusHistory.create` with `fromStatus: null`, (7) update Lead.status → BOOKED. Outside TX: `vendorStats.update totalLeadsWon: { increment: 1 }`.
- `getQuotesForLead(leadId, customerId)`: Verifies lead ownership, returns SUBMITTED quotes with `lineItems` and `vendor.businessName` ordered by `totalPaise asc`.

**QuoteExpiryProcessor** (`quote.processor.ts`, 40 lines):
- `@Processor('quote-expiry') @Injectable()` WorkerHost
- `process(job)`: `updateMany where { id: quoteId, status: 'SUBMITTED' }` → EXPIRED
- Idempotent: if quote was already ACCEPTED/REJECTED, count=0, no-op (logs debug message)

**QuoteModule** (`quote.module.ts`): Imports `PrismaModule` + `BullModule.registerQueue({ name: 'quote-expiry' })`. Providers: `QuoteService, QuoteExpiryProcessor`. Exports `QuoteService`.

**app.module.ts**: Added `QuoteModule` import after `InboxModule`.

### Task 2: QuoteController and AcceptQuoteDto (commit cbe5fe3)

**QuoteController** (`quote.controller.ts`, 105 lines) — `@Controller()` with full route paths:

Vendor endpoints (PLANNER/SUPPLIER role + VendorOwnerGuard resolves `req.vendorId`):
- `POST /leads/:leadId/quotes` → `createOrUpdateQuote(leadId, req.vendorId, dto)` → 201
- `PATCH /quotes/:id/submit` → `submitQuote(quoteId, req.vendorId)` → 200

Customer endpoints (CUSTOMER role, `user.userId` from JWT):
- `GET /leads/:leadId/quotes` → `getQuotesForLead(leadId, user.userId)` → 200
- `POST /quotes/:id/accept` → `acceptQuote(quoteId, user.userId)` → 201

**AcceptQuoteDto** (`dto/accept-quote.dto.ts`): Empty class — quoteId from URL param, customerId from JWT.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors |
| `POST /leads/:id/quotes` (no auth) | 401 |
| `PATCH /quotes/:id/submit` (no auth) | 401 |
| `GET /leads/:id/quotes` (no auth) | 401 |
| `POST /quotes/:id/accept` (no auth) | 401 |
| `QuoteModule dependencies initialized` log | PASS |
| All 4 routes in RouterExplorer log | PASS |
| `tx.booking.create` inside $transaction | PASS (code review) |
| `quoteExpiryQueue.add` outside TX | PASS (code review) |
| `QUOTES_RECEIVED` on first submit | PASS (code review) |
| `BOOKED` on accept | PASS (code review) |
| `totalLeadsWon: { increment: 1 }` | PASS (code review) |
| `updateMany where status: 'SUBMITTED'` in processor | PASS (code review) |
| quote.service.ts >= 120 lines | 317 lines — PASS |
| quote.processor.ts >= 25 lines | 40 lines — PASS |
| quote.controller.ts >= 50 lines | 105 lines — PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Server requires DATABASE_URL to start (routes appear unregistered without it)**
- **Found during:** Task 2 verification
- **Issue:** `node dist/main.js` without `DATABASE_URL` crashes with `PrismaClientInitializationError: P1012` before reaching the listen phase. Routes were correctly registered in NestJS module graph (confirmed from startup log), but curl returned 000 (connection refused) since the server never started listening.
- **Fix:** Started server with `DATABASE_URL=postgresql://... REDIS_URL=... JWT_SECRET=... node dist/main.js` for verification. All 4 routes confirmed returning 401.
- **Files modified:** None — build configuration issue, not a code issue
- **Commit:** Not applicable (dev environment behavior)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| api/src/quote/quote.service.ts | FOUND (317 lines) |
| api/src/quote/quote.processor.ts | FOUND (40 lines) |
| api/src/quote/quote.module.ts | FOUND |
| api/src/quote/quote.controller.ts | FOUND (105 lines) |
| api/src/quote/dto/create-quote.dto.ts | FOUND |
| api/src/quote/dto/accept-quote.dto.ts | FOUND |
| Commit 1833b0b | FOUND |
| Commit cbe5fe3 | FOUND |
| tx.booking.create | FOUND |
| quoteExpiryQueue.add | FOUND |
| Lead.status: QUOTES_RECEIVED | FOUND |
| Lead.status: BOOKED | FOUND |
| VendorStats.totalLeadsWon increment | FOUND |
| updateMany status: SUBMITTED (processor) | FOUND |
