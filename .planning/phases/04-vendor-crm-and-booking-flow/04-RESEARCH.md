# Phase 4: Vendor CRM and Booking Flow - Research

**Researched:** 2026-03-08
**Domain:** NestJS WebSocket gateways, Prisma state machines, booking workflows, reviews, real-time notifications
**Confidence:** HIGH

## Summary

Phase 4 builds the full CRM and booking loop on top of the existing NestJS monorepo. Three new modules are needed: an inbox/quote module (vendor lead actions + quote builder), a booking module (state machine + calendar), and a review module (verified reviews + vendor responses). The only new external dependency is Socket.IO for real-time lead delivery to vendor clients. Everything else — BullMQ, Firebase FCM, Prisma, Redis — is already installed and operational from Phase 3.

The most important design decision is the WebSocket authentication strategy. Throwing errors or using Guards inside `handleConnection` crashes the NestJS process (documented NestJS issue #2028). The safe approach is a Socket middleware registered in `afterInit` that validates the JWT from `client.handshake.auth.token` and calls `next(new Error(...))` to reject unauthenticated connections before any room joins occur. Authenticated vendors join a personal room (`vendor:{vendorId}`) on connection; the RoutingService (and any other service) emits to that room via an injected gateway reference.

The Quote and Booking state machines are enforced at the database layer using Prisma interactive transactions (`prisma.$transaction(async (tx) => {...})` with `where: { id, status: expectedPreviousStatus }`) — if the update matches zero rows, the transition is rejected. This prevents race conditions without database-level locks.

**Primary recommendation:** Install `@nestjs/websockets @nestjs/platform-socket.io socket.io` (all ^10/^4), use socket middleware for JWT auth, use personal vendor rooms for real-time delivery, enforce state transitions in Prisma interactive transactions, and recalculate `VendorStats.averageRating` inline at review submission using `(oldAvg * oldCount + newRating) / newCount`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/websockets` | ^10.4.15 | NestJS WebSocket gateway decorators | Official NestJS package; must match `@nestjs/common` major |
| `@nestjs/platform-socket.io` | ^10.4.15 | Socket.IO adapter for NestJS | Official adapter; Socket.IO 4.x is the current stable |
| `socket.io` | ^4.x | WebSocket server with rooms, auth, reconnection | Industry standard; Socket.IO v3/v4 protocol compatible |

### Already Installed (use as-is)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@nestjs/bullmq` | ^11.0.4 | Delayed job for quote expiry | Add a `quote-expiry` queue or reuse `lead-routing` queue with separate job name |
| `firebase-admin` | ^13.7.0 | FCM push at booking status transitions | Extend existing `NotificationService.sendPushToVendor` with new payload types |
| `@nestjs/jwt` | ^11.0.2 | Verify JWT in WS middleware | Inject `JwtService` from `AuthModule` (already exported) |
| `@prisma/client` | ^6.4.1 | All new schema models | Add Quote, QuoteLineItem, Booking, BookingStatusHistory, Review, BlockedDate |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO | Native `ws` package | `ws` has no room support, no reconnection, no auth middleware — Socket.IO is the right choice for vendor inbox |
| BullMQ delayed job for quote expiry | Cron job checking on read | Cron requires polling all quotes every N minutes; delayed job fires exactly when validity expires |
| Interactive Prisma transaction for state machine | Application-level status check | Application check has a TOCTOU race; interactive transaction is atomic |
| Incremental average update | `SELECT AVG(rating)` on every review | Recomputing AVG across all reviews is O(n); incremental formula is O(1) |

**Installation:**
```bash
cd api && pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── inbox/                        # Plan 04-01: Vendor lead inbox + Socket.IO gateway
│   ├── inbox.module.ts
│   ├── inbox.gateway.ts          # @WebSocketGateway — JWT middleware, room join, event emission
│   ├── inbox.service.ts          # accept/decline lead assignment, contact reveal gate
│   ├── inbox.gateway.service.ts  # thin service to emit from outside the gateway
│   └── dto/
│       ├── accept-lead.dto.ts
│       └── decline-lead.dto.ts
├── quote/                        # Plan 04-02: Quote builder + booking confirmation
│   ├── quote.module.ts
│   ├── quote.controller.ts       # PATCH quote/:id/submit, GET leads/:id/quotes
│   ├── quote.service.ts          # state machine: DRAFT→SUBMITTED→ACCEPTED/REJECTED/EXPIRED
│   ├── quote.processor.ts        # BullMQ: expire quotes on validity date
│   └── dto/
│       ├── create-quote.dto.ts
│       ├── accept-quote.dto.ts
│       └── quote-response.dto.ts
├── booking/                      # Plan 04-03: Booking status pipeline + calendar
│   ├── booking.module.ts
│   ├── booking.controller.ts     # GET /bookings/:id, PATCH /bookings/:id/status, calendar
│   ├── booking.service.ts        # status transitions + NOTF-02 push at each step
│   └── dto/
│       └── block-date.dto.ts
├── review/                       # Plan 04-03: Verified reviews + vendor response
│   ├── review.module.ts
│   ├── review.controller.ts      # POST /bookings/:id/review, POST /reviews/:id/response
│   ├── review.service.ts         # gate on COMPLETED booking, update VendorStats
│   └── dto/
│       ├── create-review.dto.ts
│       └── respond-review.dto.ts
├── routing/                      # Existing — extend to emit Socket.IO event on assignment
├── notification/                 # Existing — extend for booking status push
└── ...                           # All other existing modules unchanged
```

### Pattern 1: WebSocket Gateway with JWT Middleware
**What:** Socket.IO gateway where each vendor joins their own personal room at connection time, after JWT verification via socket middleware.
**When to use:** All real-time lead delivery (plan 04-01).

```typescript
// Source: https://preetmishra.com/blog/the-best-way-to-authenticate-websockets-in-nestjs
// Source: https://oneuptime.com/blog/post/2026-02-02-nestjs-websockets/view

import {
  WebSocketGateway, WebSocketServer,
  OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// No port argument = shares port with HTTP server
@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class InboxGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(InboxGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // CRITICAL: Register auth middleware here, NOT in handleConnection.
  // Throwing inside handleConnection crashes the server (NestJS issue #2028).
  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('Missing auth token'));
      }
      try {
        const payload = this.jwtService.verify(token);
        // Attach decoded payload; handleConnection will use this
        (socket as any).data.jwtPayload = payload;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const payload = (client as any).data.jwtPayload;
    if (!payload) {
      client.disconnect(true);
      return;
    }
    // Resolve vendorId from userId
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    });
    if (!vendor) {
      client.disconnect(true);
      return;
    }
    const room = `vendor:${vendor.id}`;
    client.join(room);
    (client as any).data.vendorId = vendor.id;
    this.logger.log(`Vendor ${vendor.id} connected — joined room ${room}`);
  }

  handleDisconnect(client: Socket) {
    const vendorId = (client as any).data?.vendorId;
    this.logger.log(`Vendor ${vendorId ?? 'unknown'} disconnected`);
  }
}
```

### Pattern 2: Emitting to a Vendor Room from Another Service
**What:** RoutingService (or any service) emits `new_lead` event to a vendor's room via the injected gateway.
**When to use:** When a lead is assigned (RoutingService), quote accepted, or booking status changes.

```typescript
// InboxGateway exposes a method other services can call:
// Add to InboxGateway class:
emitToVendor(vendorId: string, event: string, data: unknown): void {
  this.server.to(`vendor:${vendorId}`).emit(event, data);
}

// In RoutingModule, import InboxModule and inject InboxGateway:
// RoutingService.routeDirect / routeTopThree, after creating assignment:
this.inboxGateway.emitToVendor(vendorId, 'new_lead', {
  assignmentId: assignment.id,
  leadId,
  eventType: lead.eventType,
  city: lead.city,
  budget: lead.budget,        // in paise
  eventDate: lead.eventDate,
  // Customer phone is NOT included here — revealed only after accept
});
```

**Module wiring:** `InboxModule` must export `InboxGateway`. `RoutingModule` imports `InboxModule`.

### Pattern 3: Quote State Machine with Prisma Interactive Transaction
**What:** State transitions are enforced atomically by filtering `update` on the expected prior status.
**When to use:** All Quote and Booking state changes.

```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
// Quote states: DRAFT → SUBMITTED → ACCEPTED | REJECTED | EXPIRED

async submitQuote(quoteId: string, vendorId: string): Promise<Quote> {
  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quoteId, vendorId, status: 'DRAFT' },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new BadRequestException(
        'Quote not found or not in DRAFT state',
      );
    }
    return tx.quote.findUnique({ where: { id: quoteId }, include: { lineItems: true } });
  });
}

// Booking states: INQUIRY → QUOTES_RECEIVED → BOOKED → IN_PROGRESS → COMPLETED | CANCELLED
// Same pattern — updateMany with where: { id, status: expectedPrevious }
```

### Pattern 4: Contact Reveal Gate
**What:** When vendor accepts a lead assignment, record PHONE_REVEAL consent and return unmasked customer phone.
**When to use:** `PATCH /lead-assignments/:id/accept` endpoint in InboxService.

```typescript
// InboxService.acceptLead(assignmentId, vendorId):
async acceptLead(assignmentId: string, vendorId: string): Promise<{ phone: string }> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Transition assignment NOTIFIED → ACCEPTED
    const updated = await tx.leadAssignment.updateMany({
      where: { id: assignmentId, vendorId, status: 'NOTIFIED' },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    if (updated.count === 0) throw new BadRequestException('Assignment not found or already responded');

    // 2. Update VendorStats.responseRate (increment accepted count)
    //    (done outside transaction to avoid long-running TX — see pitfall section)

    // 3. Fetch customer phone
    const assignment = await tx.leadAssignment.findUnique({
      where: { id: assignmentId },
      include: { lead: { include: { customer: { select: { phone: true, id: true } } } } },
    });
    const customer = assignment.lead.customer;

    // 4. Record PHONE_REVEAL consent (append-only DPDP log)
    await tx.consentLog.create({
      data: {
        userId: customer.id,
        consentType: 'PHONE_REVEAL',
        status: 'GRANTED',
        metadata: { targetUserId: vendorId },
      },
    });

    return { phone: customer.phone }; // unmasked — vendor earned it by accepting
  });
}
```

### Pattern 5: BullMQ Delayed Job for Quote Expiry
**What:** When a quote is submitted with a validity period, enqueue a delayed job to set its status to EXPIRED.
**When to use:** `QuoteService.submitQuote`.

```typescript
// Source: https://docs.bullmq.io/guide/jobs/delayed
// delay is in milliseconds from now

const validUntil = new Date(dto.validUntilDate);
const delayMs = validUntil.getTime() - Date.now();

await this.quoteExpiryQueue.add(
  'expire-quote',
  { quoteId: quote.id },
  { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
);
```

```typescript
// QuoteExpiryProcessor (WorkerHost):
async process(job: Job<{ quoteId: string }>): Promise<void> {
  // Only expire if still SUBMITTED — idempotent: if already ACCEPTED, do nothing
  await this.prisma.quote.updateMany({
    where: { id: job.data.quoteId, status: 'SUBMITTED' },
    data: { status: 'EXPIRED' },
  });
}
```

### Pattern 6: Incremental Average Rating Update
**What:** When a new review is saved, update `VendorStats.averageRating` using the incremental formula instead of recalculating across all reviews.
**When to use:** `ReviewService.createReview`, after saving the review record.

```typescript
// Incremental average: newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
// This is O(1) — no need to re-query all reviews.

const stats = await this.prisma.vendorStats.findUnique({ where: { vendorId } });
const oldCount = stats.totalReviewCount ?? 0;    // new field to add to VendorStats
const oldAvg = stats.averageRating ?? 3.0;
const newAvg = (oldAvg * oldCount + review.rating) / (oldCount + 1);

await this.prisma.vendorStats.update({
  where: { vendorId },
  data: {
    averageRating: newAvg,
    totalReviewCount: oldCount + 1,
  },
});

// Also invalidate the scoring cache so next routing picks up new rating:
await this.redis.del(`vendor:score:factors:${vendorId}`);
```

### Pattern 7: NOTF-02 Push at Booking Status Transitions
**What:** Extend `NotificationService` with a customer-targeted push method; call at each booking status change.
**When to use:** `BookingService.transitionStatus`.

```typescript
// Add to NotificationService:
async sendPushToCustomer(
  customerId: string,
  payload: { title: string; body: string; data: Record<string, string> },
): Promise<void> {
  // Same pattern as sendPushToVendor but for customerId
  const devices = await this.prisma.deviceToken.findMany({
    where: { userId: customerId, isActive: true },
  });
  // ... FCM send loop (same token-deactivation logic)
}

// BookingService.transitionStatus calls:
const pushMessages: Record<string, { title: string; body: string }> = {
  QUOTES_RECEIVED: { title: 'Quotes Ready', body: 'Vendors have submitted quotes for your inquiry.' },
  BOOKED: { title: 'Booking Confirmed', body: 'Your booking has been confirmed.' },
  IN_PROGRESS: { title: 'Event in Progress', body: 'Your vendor is on the way.' },
  COMPLETED: { title: 'Event Completed', body: 'How did it go? Leave a review.' },
  CANCELLED: { title: 'Booking Cancelled', body: 'Your booking has been cancelled.' },
};
```

### Anti-Patterns to Avoid

- **Throwing inside `handleConnection`:** NestJS issue #2028 — throwing any error in `handleConnection` crashes the server. Always disconnect via `client.disconnect(true)` and return. JWT validation must happen in `afterInit`'s socket middleware.
- **Sharing the HTTP port explicitly:** `@WebSocketGateway()` with no port argument shares the HTTP port automatically. Passing a port creates a *separate* server, which complicates deployment.
- **Storing Quote line items in a JSON column:** Line items need to be individually queryable (for total recalculation, for rendering). Use a `QuoteLineItem` table with FK to `Quote`.
- **Re-running `AVG(rating)` on every review:** O(n) query; use incremental formula with `totalReviewCount` on `VendorStats`.
- **Checking status in application code before transition:** TOCTOU race. Always use `updateMany` with `where: { status: expected }` and check `updated.count`.
- **Allowing customer phone in the Socket.IO `new_lead` event payload:** The contact reveal gate only fires after the vendor explicitly accepts. Never include `customer.phone` in the real-time push.

## New Prisma Schema Models

### Complete Phase 4 Schema Additions

```prisma
// ──────────────────────────────────────────────────
// Phase 4: Vendor CRM and Booking Flow
// ──────────────────────────────────────────────────

model Quote {
  id            String          @id @default(uuid()) @db.Uuid
  leadId        String          @map("lead_id") @db.Uuid
  vendorId      String          @map("vendor_id") @db.Uuid
  // status: DRAFT | SUBMITTED | ACCEPTED | REJECTED | EXPIRED
  status        String          @default("DRAFT") @db.VarChar(20)
  totalPaise    Int             @map("total_paise")        // sum of line items in paise
  validUntil    DateTime        @map("valid_until")        // vendor sets validity
  note          String?         @db.Text                   // optional vendor message
  submittedAt   DateTime?       @map("submitted_at")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  lead          Lead            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  vendor        VendorProfile   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  lineItems     QuoteLineItem[]
  booking       Booking?

  @@unique([leadId, vendorId])   // one quote per vendor per lead
  @@index([leadId])
  @@index([vendorId])
  @@index([status])
  @@map("quotes")
}

model QuoteLineItem {
  id          String  @id @default(uuid()) @db.Uuid
  quoteId     String  @map("quote_id") @db.Uuid
  description String  @db.VarChar(255)
  amountPaise Int     @map("amount_paise")
  quantity    Int     @default(1)

  quote       Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@index([quoteId])
  @@map("quote_line_items")
}

model Booking {
  id               String                @id @default(uuid()) @db.Uuid
  leadId           String                @map("lead_id") @db.Uuid
  quoteId          String                @unique @map("quote_id") @db.Uuid    // accepted quote
  customerId       String                @map("customer_id") @db.Uuid
  vendorId         String                @map("vendor_id") @db.Uuid
  // status: BOOKED | IN_PROGRESS | COMPLETED | CANCELLED
  status           String                @default("BOOKED") @db.VarChar(20)
  confirmedAt      DateTime              @default(now()) @map("confirmed_at")
  completedAt      DateTime?             @map("completed_at")
  cancelledAt      DateTime?             @map("cancelled_at")
  cancellationNote String?               @map("cancellation_note") @db.Text
  createdAt        DateTime              @default(now()) @map("created_at")
  updatedAt        DateTime              @updatedAt @map("updated_at")

  lead             Lead                  @relation(fields: [leadId], references: [id], onDelete: Cascade)
  quote            Quote                 @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  customer         User                  @relation("CustomerBookings", fields: [customerId], references: [id], onDelete: Cascade)
  vendor           VendorProfile         @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  statusHistory    BookingStatusHistory[]
  review           Review?

  @@index([customerId])
  @@index([vendorId])
  @@index([status])
  @@map("bookings")
}

model BookingStatusHistory {
  id        String   @id @default(uuid()) @db.Uuid
  bookingId String   @map("booking_id") @db.Uuid
  fromStatus String? @map("from_status") @db.VarChar(20)  // null for initial creation
  toStatus  String   @map("to_status") @db.VarChar(20)
  note      String?  @db.Text
  changedAt DateTime @default(now()) @map("changed_at")

  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([bookingId])
  @@map("booking_status_history")
}

model Review {
  id              String        @id @default(uuid()) @db.Uuid
  bookingId       String        @unique @map("booking_id") @db.Uuid  // one review per booking
  customerId      String        @map("customer_id") @db.Uuid
  vendorId        String        @map("vendor_id") @db.Uuid
  rating          Int           // 1-5
  comment         String?       @db.Text
  vendorResponse  String?       @map("vendor_response") @db.Text
  respondedAt     DateTime?     @map("responded_at")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  booking         Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  customer        User          @relation("CustomerReviews", fields: [customerId], references: [id], onDelete: Cascade)
  vendor          VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@index([vendorId])
  @@index([customerId])
  @@map("reviews")
}

model BlockedDate {
  id        String        @id @default(uuid()) @db.Uuid
  vendorId  String        @map("vendor_id") @db.Uuid
  date      DateTime      @db.Date      // the blocked calendar date (date only, no time)
  reason    String?       @db.VarChar(100)
  createdAt DateTime      @default(now()) @map("created_at")

  vendor    VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@unique([vendorId, date])
  @@index([vendorId])
  @@map("blocked_dates")
}
```

### VendorStats Model Extension (existing model — add fields)
```prisma
// Add to existing VendorStats model:
totalReviewCount   Int  @default(0) @map("total_review_count")
// totalLeadsWon already exists — increment when booking confirmed
// totalLeadsReceived already exists
```

### Existing Model Relations to Add
```prisma
// On Lead model, add:
quotes   Quote[]
booking  Booking?

// On User model, add:
bookings         Booking[]  @relation("CustomerBookings")
reviews          Review[]   @relation("CustomerReviews")

// On VendorProfile model, add:
quotes           Quote[]
bookings         Booking[]
blockedDates     BlockedDate[]
reviews          Review[]
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time lead delivery | HTTP polling / custom pub-sub | `@nestjs/websockets` + `socket.io` rooms | Reconnection, room management, CORS, auth middleware built-in |
| Quote expiry | Cron checking all quotes | BullMQ delayed job per quote | Fires precisely at `validUntil`; no polling overhead |
| State transition safety | Application-level status check | Prisma `$transaction` with `updateMany({ where: { status: expected } })` | Prevents TOCTOU race when concurrent requests hit the same record |
| Average rating | Full `AVG(rating)` requery | Incremental formula: `(oldAvg * oldCount + rating) / (oldCount + 1)` | O(1) vs O(n); VendorStats already stores `averageRating` |
| Socket auth | Custom token table lookup | `jwtService.verify()` in socket middleware | JwtModule already imported in AuthModule; reuse the same secret |
| Contact masking | Custom regex | Existing `ContactMaskingService.maskPhone()` | Already exported from `PrivacyModule` |

## Common Pitfalls

### Pitfall 1: Throwing in `handleConnection` Crashes the Server
**What goes wrong:** Server process crashes on the next unauthenticated connection attempt.
**Why it happens:** NestJS wraps `handleConnection` but does not catch exceptions in a safe way (documented in NestJS issue #2028). `WsException` and standard `Error` both crash.
**How to avoid:** All authentication logic goes in `afterInit`'s `server.use(middleware)`. The middleware calls `next(new Error('...'))` to reject the connection. `handleConnection` only calls `client.disconnect(true)` + `return` if the payload is unexpectedly absent.
**Warning signs:** Server restarts after the first failed connection attempt.

### Pitfall 2: Quote One-Per-Vendor-Per-Lead Constraint
**What goes wrong:** A vendor resubmits a quote, creating a second quote row for the same lead, causing duplicate display in the customer's comparison view.
**Why it happens:** No database constraint prevents two Quote rows with same `(leadId, vendorId)`.
**How to avoid:** `@@unique([leadId, vendorId])` on the `Quote` model. `QuoteService.createQuote` must upsert (update if DRAFT exists) or reject if already SUBMITTED.
**Warning signs:** Customer sees duplicate vendor quotes.

### Pitfall 3: Quote Expiry Job Fires After Quote is Already Accepted
**What goes wrong:** `expire-quote` job fires, transitions ACCEPTED quote to EXPIRED.
**Why it happens:** BullMQ jobs do not know about application state changes that happened after enqueue.
**How to avoid:** `QuoteExpiryProcessor` uses `updateMany({ where: { id: quoteId, status: 'SUBMITTED' } })` — idempotent. If status is already ACCEPTED, the update matches zero rows and no state change occurs.
**Warning signs:** ACCEPTED quotes showing as EXPIRED.

### Pitfall 4: LeadAssignment `respondedAt` / `status` Update Missed
**What goes wrong:** `VendorStats.responseRate` becomes stale; routing scores are incorrect.
**Why it happens:** Developer updates `status` on accept/decline but forgets to invalidate `vendor:score:factors:{vendorId}` Redis cache.
**How to avoid:** After every `LeadAssignment` status change (ACCEPTED or DECLINED), call `this.redis.del(`vendor:score:factors:${vendorId}`)`.
**Warning signs:** `responseRate` in scoring stays at 0.5 (default) even after vendor has accepted many leads.

### Pitfall 5: VendorStats `totalLeadsWon` Not Incremented on Booking
**What goes wrong:** Earnings dashboard shows wrong "leads won" metric.
**Why it happens:** `totalLeadsWon` was intended to track bookings but no code increments it.
**How to avoid:** When a quote is accepted and a `Booking` is created, run `prisma.vendorStats.update({ where: { vendorId }, data: { totalLeadsWon: { increment: 1 } } })`.
**Warning signs:** `totalLeadsWon` stays at 0 for active vendors.

### Pitfall 6: Review Allowed Before Booking is COMPLETED
**What goes wrong:** Customer submits a review for an in-progress or cancelled booking.
**Why it happens:** Review endpoint doesn't check booking status before allowing submission.
**How to avoid:** `ReviewService.createReview` verifies `booking.status === 'COMPLETED'` and `booking.customerId === requestingUserId` before creating the review. Return `403 Forbidden` otherwise.
**Warning signs:** Reviews exist for bookings with status BOOKED or IN_PROGRESS.

### Pitfall 7: Socket.IO CORS Configuration
**What goes wrong:** Mobile client (React Native + socket.io-client) fails to connect; browser clients work.
**Why it happens:** Default `@WebSocketGateway({ cors: false })` or over-restrictive origin whitelist.
**How to avoid:** `@WebSocketGateway({ cors: { origin: '*', credentials: true } })` for development. In production, restrict to known client origins via environment variable. Mobile clients don't send an `Origin` header, so `origin: '*'` or a function-based origin check is required.
**Warning signs:** `Error: websocket error` in mobile app; browser app works fine.

### Pitfall 8: `BlockedDate` Uses `DateTime` Without Normalizing to Midnight
**What goes wrong:** Two blocked date records for the same calendar day with different times (00:00:00 vs 12:00:00) bypass the `@@unique([vendorId, date])` constraint.
**Why it happens:** `DateTime` in Prisma maps to PostgreSQL `timestamp` unless `@db.Date` is used.
**How to avoid:** Use `@db.Date` on the `date` column. The column stores only the calendar date, not a time component. `@@unique([vendorId, date])` then works correctly.
**Warning signs:** Duplicate blocked date rows per calendar day.

## Code Examples

### WebSocket Gateway Module Registration
```typescript
// inbox.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InboxGateway } from './inbox.gateway';
import { InboxService } from './inbox.service';

@Module({
  imports: [PrismaModule, AuthModule],  // AuthModule exports JwtModule
  providers: [InboxGateway, InboxService],
  exports: [InboxGateway],              // exported so RoutingModule can inject it
})
export class InboxModule {}
```

### Quote Accept Flow (customer side)
```typescript
// QuoteService.acceptQuote — transitions quote SUBMITTED→ACCEPTED, creates Booking
async acceptQuote(
  quoteId: string,
  customerId: string,
): Promise<Booking> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Mark this quote ACCEPTED (must be SUBMITTED)
    const quoteUpdate = await tx.quote.updateMany({
      where: { id: quoteId, status: 'SUBMITTED' },
      data: { status: 'ACCEPTED' },
    });
    if (quoteUpdate.count === 0) {
      throw new BadRequestException('Quote not found or not in SUBMITTED state');
    }

    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { lead: true },
    });

    // 2. Reject all other quotes for this lead
    await tx.quote.updateMany({
      where: { leadId: quote.leadId, id: { not: quoteId }, status: 'SUBMITTED' },
      data: { status: 'REJECTED' },
    });

    // 3. Create Booking
    const booking = await tx.booking.create({
      data: {
        leadId: quote.leadId,
        quoteId: quote.id,
        customerId,
        vendorId: quote.vendorId,
        status: 'BOOKED',
      },
    });

    // 4. Record initial status history entry
    await tx.bookingStatusHistory.create({
      data: { bookingId: booking.id, fromStatus: null, toStatus: 'BOOKED' },
    });

    return booking;
  });
}
```

### Vendor Earnings Dashboard Query (live aggregate)
```typescript
// BookingService.getVendorEarnings — live query, not pre-computed
async getVendorEarnings(vendorId: string): Promise<{
  leadsReceived: number;
  leadsWon: number;
  completedBookings: number;
  totalEarningsPaise: number;
}> {
  const stats = await this.prisma.vendorStats.findUnique({
    where: { vendorId },
    select: { totalLeadsReceived: true, totalLeadsWon: true },
  });

  const completedBookings = await this.prisma.booking.count({
    where: { vendorId, status: 'COMPLETED' },
  });

  // Sum accepted quote amounts for completed bookings
  const earningsResult = await this.prisma.booking.findMany({
    where: { vendorId, status: 'COMPLETED' },
    include: { quote: { select: { totalPaise: true } } },
  });
  const totalEarningsPaise = earningsResult.reduce(
    (sum, b) => sum + (b.quote?.totalPaise ?? 0),
    0,
  );

  return {
    leadsReceived: stats?.totalLeadsReceived ?? 0,
    leadsWon: stats?.totalLeadsWon ?? 0,
    completedBookings,
    totalEarningsPaise,
  };
}
```

## State Machines

### Quote State Machine
```
DRAFT ──submit──► SUBMITTED ──customer accepts──► ACCEPTED
                      │
                      ├──customer rejects another quote──► REJECTED (other quotes)
                      │
                      └──validity date passes──► EXPIRED (BullMQ delayed job)
```

- **DRAFT:** Vendor is building the quote. Not visible to customer yet.
- **SUBMITTED:** Vendor submitted. Visible to customer for comparison.
- **ACCEPTED:** Customer chose this quote. Triggers `Booking` creation.
- **REJECTED:** Customer chose a different vendor's quote.
- **EXPIRED:** `validUntil` passed without customer action.

### Booking State Machine
```
(Quote accepted) ──► BOOKED ──► IN_PROGRESS ──► COMPLETED
                        │                           │
                        └──► CANCELLED              └──► (Review allowed)
```

- **BOOKED:** Quote accepted, booking confirmed. Push: "Booking Confirmed".
- **IN_PROGRESS:** Vendor marks event started. Push: "Event in Progress".
- **COMPLETED:** Vendor marks event done. Push: "Event Completed — Leave a Review".
- **CANCELLED:** Either party cancels. Push: "Booking Cancelled".

Allowed transitions (enforced by `updateMany` `where: { status: from }`):
- `BOOKED → IN_PROGRESS` (vendor action)
- `BOOKED → CANCELLED` (either party)
- `IN_PROGRESS → COMPLETED` (vendor action)
- `IN_PROGRESS → CANCELLED` (either party)

### LeadAssignment Status (existing, Phase 3)
- `PENDING → NOTIFIED` (RoutingProcessor, after FCM push)
- `NOTIFIED → ACCEPTED` (vendor action via InboxService — triggers contact reveal)
- `NOTIFIED → DECLINED` (vendor action with reason)

## Architecture Decision: Pre-compute vs Live Query for Earnings Dashboard

**Decision: Use `VendorStats` for counts (totalLeadsReceived, totalLeadsWon) and a live aggregate query for totalEarningsPaise.**

Rationale:
- `totalLeadsReceived` and `totalLeadsWon` are already maintained as increment-on-event counters in `VendorStats`. Reusing them is O(1).
- `totalEarningsPaise` requires summing `quote.totalPaise` for completed bookings. For Phase 4 scale (likely < 1000 bookings per vendor), a live aggregation query is acceptable. Pre-computing this would require a background job and adds complexity.
- If earnings queries become slow at scale, add a `totalEarningsPaise` counter to `VendorStats` later.

## Architecture Decision: Calendar Date Blocking Design

**Decision: Use a `BlockedDate` table (one row per blocked date) with `@db.Date` column.**

Rationale: The alternative (a date range `blockedFrom/blockedTo`) is harder to query ("is this specific date blocked?") and more complex to maintain (overlapping ranges). A simple table with `@@unique([vendorId, date])` allows `SELECT EXISTS WHERE vendorId = ? AND date = ?` which is a single indexed lookup.

## Open Questions

1. **Who can transition Booking to CANCELLED?**
   - What we know: Success criterion only says "status progresses"; no cancellation policy defined.
   - What's unclear: Can a customer cancel a BOOKED booking? Can a vendor? Are there penalties?
   - Recommendation: Allow both parties to cancel from BOOKED or IN_PROGRESS. Record who cancelled in `cancellationNote`. No penalty logic in Phase 4.

2. **Lead status (INQUIRY vs QUOTES_RECEIVED transition)**
   - What we know: Success criterion mentions "Lead.status: Inquiry → Quotes Received → Booked → Completed". The existing Lead model has `PENDING, ROUTING, ROUTED` statuses.
   - What's unclear: Should `Lead.status` be extended with `QUOTES_RECEIVED, BOOKED, COMPLETED` or should the booking status be the source of truth?
   - Recommendation: Extend `Lead.status` with `QUOTES_RECEIVED` (set when first quote is submitted), `BOOKED` (set when booking is created), `COMPLETED` (set when booking completes). This gives the customer a single "inquiry status" to display. The `Booking` model tracks the operational detail.

3. **Quote validity: can a SUBMITTED quote be edited?**
   - What we know: Requirements say "customized quote with line items, total price, and validity period". No mention of editing after submission.
   - Recommendation: Allow re-draft only if still in DRAFT status. Once SUBMITTED, the quote is locked. Vendor must contact customer out-of-band to negotiate. This keeps the state machine simple.

4. **Socket.IO client version for React Native**
   - What we know: Socket.IO v4 is used server-side.
   - What's unclear: Mobile client library version and compatibility.
   - Recommendation: Use `socket.io-client` v4.x on the mobile client. The Socket.IO v3/v4 protocol is compatible; v2 client requires `allowEIO3: true` on the server which should be avoided.

## Sources

### Primary (HIGH confidence)
- NestJS WebSocket Gateways: https://docs.nestjs.com/websockets/gateways — gateway setup, decorators, room management
- NestJS WebSocket Guards: https://docs.nestjs.com/websockets/guards — WsException, guard pattern
- Prisma Transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions — interactive transactions, updateMany-with-where pattern
- BullMQ Delayed Jobs: https://docs.bullmq.io/guide/jobs/delayed — delay parameter (milliseconds), changeDelay, gotchas
- Firebase Admin Node SDK: https://firebase.google.com/docs/admin/setup — send() API (already verified in Phase 3)

### Secondary (MEDIUM confidence)
- WebSocket auth best practice (socket middleware vs handleConnection): https://preetmishra.com/blog/the-best-way-to-authenticate-websockets-in-nestjs
- NestJS WebSocket complete guide (Feb 2026): https://oneuptime.com/blog/post/2026-02-02-nestjs-websockets/view — gateway setup, JWT guard, rooms, emit patterns
- Emitting from service via gateway injection: https://blog.logrocket.com/scalable-websockets-with-nestjs-and-redis/ — RedisPropagatorService pattern; simpler direct injection works for single-instance
- NestJS issue #2028: https://github.com/nestjs/nest/issues/2028 — confirmed crash behavior when throwing in handleConnection

### Tertiary (LOW confidence)
- Incremental average rating formula: standard mathematical identity (verified logic, but no external source needed)
- Earnings dashboard live vs pre-compute tradeoff: engineering judgment based on Phase 4 scale

## Metadata

**Confidence breakdown:**
- WebSocket gateway + JWT auth: HIGH — multiple verified sources confirm socket middleware approach; NestJS issue confirms handleConnection crash
- New Prisma schema models: HIGH — designed from requirements with FK integrity, state machine constraints
- Quote/Booking state machines: HIGH — Prisma interactive transactions with `updateMany` where-clause enforcement is documented pattern
- BullMQ delayed job for quote expiry: HIGH — official BullMQ docs confirm delay-in-milliseconds API
- Incremental average rating: HIGH — mathematical formula, verified against VendorStats existing structure
- Earnings dashboard query: MEDIUM — live aggregate is fine for MVP scale; flag if > 10k bookings/vendor
- Socket.IO mobile client compatibility: MEDIUM — v4 protocol compatibility confirmed; specific React Native behavior depends on client lib

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (30 days — stack is stable; NestJS 10.x + Socket.IO 4.x are current)
