# Phase 7: Analytics and Admin Hardening - Research

**Researched:** 2026-03-13
**Domain:** Admin analytics dashboard, lead routing audit log, manual routing override, market status management; all within existing NestJS + Prisma + PostgreSQL stack
**Confidence:** HIGH

## Summary

Phase 7 has two distinct deliverables. The first (07-01) is an analytics dashboard for admins: leads per city, conversion funnel (PENDING → NOTIFIED → QUOTES_RECEIVED → BOOKED → COMPLETED), revenue by transaction type (SUBSCRIPTION, LEAD_PURCHASE, BOOKING_COMMISSION, MARKETPLACE_SALE), and active vendor count — all reflecting the last 24 hours. The second (07-02) is a lead routing audit log and manual override capability: per-lead scoring trace (which vendors were scored, their factor scores, final composite score, and why they were selected or skipped), plus an admin UI endpoint to re-route a specific lead to a different vendor.

The primary technical constraint is that the ScoringService currently computes scores and discards them. The routing audit log requires a new `LeadRoutingTrace` Prisma model and a targeted modification to `RoutingService.routeTopThree` to persist the trace data after computing scores. This is a schema migration plus a targeted service change — it does not require rewriting the scoring logic, since `ScoringService.scoreVendors` already returns all scored vendors with their composite scores.

For analytics, all data already exists across Phase 1-6 models (Lead, LeadAssignment, Booking, Transaction, VendorProfile, Market). The challenge is query optimization: a 24-hour analytics query across these tables must be fast enough for an admin dashboard refresh (target: under 2 seconds). Prisma's `groupBy` API handles the aggregation use cases cleanly. For time-windowed queries (last 24 hours), using `createdAt >= new Date(Date.now() - 86400000)` filters on existing indexed `createdAt` fields. Materialized views are an optimization that can be added if queries prove slow in production — do NOT build them upfront (premature optimization; Prisma materialized view support is still limited and requires raw SQL).

**Primary recommendation:** Add `LeadRoutingTrace` model to schema + modify `RoutingService.routeTopThree` to write trace rows. Add analytics and routing-audit endpoints to the existing AdminController/AdminService. Use Prisma `groupBy` + `aggregate` + targeted `$queryRaw` for analytics queries. No new libraries required.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | 6.4.1 (installed) | LeadRoutingTrace model; groupBy/aggregate for analytics; $queryRaw for date_trunc queries | Already the project ORM; groupBy supports _sum, _count with where/having; $queryRaw handles date_trunc |
| @nestjs/common | 10.4.15 (installed) | AdminController endpoints for analytics + routing audit | Already used throughout |
| ioredis | 5.4.2 (installed) | Read fairness counters in real-time for routing trace context | Already used by ScoringService for fairness:vendorId keys |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-validator | 0.15.1 (installed) | DTO validation for override payload, market status updates | Already used |
| class-transformer | 0.5.1 (installed) | Query param transformation (page, limit, dateFrom) | Already used in admin endpoints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma groupBy + $queryRaw | PostgreSQL materialized views | Materialized views are not natively supported by Prisma (requires raw SQL + manual REFRESH; views are still Preview in Prisma 6.4). Use groupBy first; add materialized views as a performance optimization only if proven slow in production |
| groupBy with date_trunc | Application-side aggregation | date_trunc in raw SQL is more accurate for "last 24h by hour" breakdown; application-side grouping is fine for totals but wasteful for time-series data |
| Inline scoring trace in RoutingService | Separate TraceService | Tracing is a side-effect of routing, not a domain concern. Inline write in RoutingService.routeTopThree is simpler and avoids circular dependency issues |
| Full re-route (delete assignments + re-route) | Score override only | Admin manual override should replace vendor assignments cleanly; full re-route is cleaner than patching scores |

**No new installations needed.** All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure Changes

```
api/src/
  admin/
    admin.controller.ts       # EXTEND: add analytics + routing audit endpoints
    admin.service.ts          # EXTEND: add analytics queries + routing audit + override logic
    dto/
      analytics-query.dto.ts  # { dateFrom?, dateTo?, city? } — optional, defaults to last 24h
      routing-override.dto.ts # { vendorId: string; reason?: string }
  routing/
    routing.service.ts        # MODIFY: routeTopThree writes LeadRoutingTrace rows after scoring
```

```
api/prisma/
  schema.prisma               # ADD: LeadRoutingTrace model
  migrations/
    [timestamp]_add_lead_routing_trace/  # New migration
```

### Pattern 1: LeadRoutingTrace — New Prisma Model

**What:** Persists the full scoring trace for every Mode B routing event. One row per vendor evaluated (not just selected). Enables admin to see all scored vendors, their factor scores, composite score, selection outcome, and skip reason.

**When to use:** Written by RoutingService.routeTopThree immediately after scoring completes, within the same async flow (not a separate queue job — latency here is acceptable, trace writes are fire-and-continue not on the critical path).

```prisma
// Source: Derived from existing schema conventions (UUID, @map, @@map, @index)
model LeadRoutingTrace {
  id              String   @id @default(uuid()) @db.Uuid
  leadId          String   @map("lead_id") @db.Uuid
  vendorId        String   @map("vendor_id") @db.Uuid

  // Composite score (0-1 float)
  score           Float

  // Individual factor scores stored as JSON for forward compatibility
  // Shape: { subscriptionTier, tierScore, averageRating, ratingScore,
  //           responseRate, responseScore, locationMatch, locationScore,
  //           fairnessCount, fairnessScore }
  scoreFactors    Json     @map("score_factors")

  // Whether this vendor was selected for assignment
  selected        Boolean  @default(false)

  // Why not selected (if selected=false): 'FAIRNESS_CAP' | 'TOP_N_LIMIT' | 'NO_VENDORS'
  skipReason      String?  @map("skip_reason") @db.VarChar(30)

  // Admin override tracking
  overriddenAt    DateTime? @map("overridden_at")
  overriddenBy    String?   @map("overridden_by") @db.Uuid
  overrideReason  String?   @map("override_reason") @db.Text

  createdAt       DateTime @default(now()) @map("created_at")

  lead            Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  vendor          VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@unique([leadId, vendorId])
  @@index([leadId])
  @@index([vendorId])
  @@map("lead_routing_traces")
}
```

Relations to add to existing models:
```prisma
// Add to Lead model:
  routingTraces   LeadRoutingTrace[]

// Add to VendorProfile model:
  routingTraces   LeadRoutingTrace[]
```

### Pattern 2: RoutingService.routeTopThree — Trace Write Integration

**What:** After `scoreVendors` returns, write one `LeadRoutingTrace` row per evaluated vendor. This happens after assignment creation. The trace write is non-atomic relative to assignments (acceptable — trace is audit data, not operational data; if trace write fails, the assignment already succeeded and the lead is routed).

**When to use:** End of `routeTopThree`, after all assignments are created and vendors notified.

```typescript
// Source: Existing RoutingService.routeTopThree pattern
// Add after the existing notification loop:

// Write routing trace for all evaluated vendors
const traceRows = scored.map((entry) => {
  const isSelected = selected.some((s) => s.vendorId === entry.vendorId);
  let skipReason: string | null = null;

  if (!isSelected) {
    // Check if skipped due to fairness cap or top-N cutoff
    const fairnessRaw = await this.redis.get(`fairness:${entry.vendorId}`);
    const count = fairnessRaw ? parseInt(fairnessRaw, 10) : 0;
    skipReason = count >= MAX_LEADS_PER_WINDOW ? 'FAIRNESS_CAP' : 'TOP_N_LIMIT';
  }

  return {
    leadId,
    vendorId: entry.vendorId,
    score: entry.score,
    scoreFactors: entry.factors,  // extend scoreVendors to return factors alongside score
    selected: isSelected,
    skipReason,
  };
});

await this.prisma.leadRoutingTrace.createMany({ data: traceRows });
```

Note: `scoreVendors` must be extended to return `{ vendorId, score, factors }` triples, not just `{ vendorId, score }`. This is a small change to `ScoringService.scoreVendors`.

### Pattern 3: Analytics Dashboard — Prisma groupBy + aggregate

**What:** Aggregate Lead, Booking, Transaction, and VendorProfile data for last-24h window. Use Prisma's native `groupBy` where possible; fall back to `$queryRaw` for date_trunc grouping.

**When to use:** Admin dashboard endpoint `GET /admin/analytics/dashboard`.

```typescript
// Source: Prisma docs - aggregation-grouping-summarizing
// https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing

async getDashboard() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    leadsPerCity,
    conversionFunnel,
    revenueByStream,
    activeVendorCount,
  ] = await Promise.all([
    // Leads per city (last 24h)
    this.prisma.lead.groupBy({
      by: ['city'],
      _count: { id: true },
      where: { createdAt: { gte: since } },
      orderBy: { _count: { id: 'desc' } },
    }),

    // Conversion funnel: count of leads at each status
    this.prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { createdAt: { gte: since } },
    }),

    // Revenue by stream (last 24h, PAID only)
    this.prisma.transaction.groupBy({
      by: ['type'],
      _sum: { amountPaise: true, commissionPaise: true },
      _count: { id: true },
      where: {
        status: 'PAID',
        createdAt: { gte: since },
      },
    }),

    // Active vendor count (approved + active subscription)
    this.prisma.vendorProfile.count({
      where: {
        status: 'APPROVED',
        subscription: { status: { in: ['ACTIVE', 'AUTHENTICATED'] } },
      },
    }),
  ]);

  return { leadsPerCity, conversionFunnel, revenueByStream, activeVendorCount };
}
```

### Pattern 4: Routing Audit Log — Per-Lead Trace View

**What:** Return full scoring trace for a specific lead: all vendors evaluated, their scores and factors, selection outcome, current assignment status.

**When to use:** Admin inspects why a specific lead was routed the way it was.

```typescript
// Source: Existing AdminService patterns
async getLeadRoutingTrace(leadId: string) {
  const traces = await this.prisma.leadRoutingTrace.findMany({
    where: { leadId },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          subscription: {
            select: { plan: { select: { tier: true } } },
          },
        },
      },
    },
    orderBy: { score: 'desc' },
  });

  const assignments = await this.prisma.leadAssignment.findMany({
    where: { leadId },
    select: { vendorId: true, status: true, notifiedAt: true, respondedAt: true },
  });

  return { leadId, traces, assignments };
}
```

### Pattern 5: Manual Routing Override

**What:** Admin manually assigns a lead to a specific vendor, cancelling existing assignments and creating a new one. Writes override metadata to the trace.

**When to use:** Admin override endpoint `PATCH /admin/leads/:leadId/routing-override`.

```typescript
// Source: Existing AdminService + RoutingService patterns
async overrideRouting(leadId: string, vendorId: string, adminId: string, reason?: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Cancel existing PENDING/NOTIFIED assignments
    await tx.leadAssignment.updateMany({
      where: { leadId, status: { in: ['PENDING', 'NOTIFIED'] } },
      data: { status: 'CANCELLED' },
    });

    // 2. Create new assignment for override vendor
    await tx.leadAssignment.create({
      data: {
        leadId,
        vendorId,
        score: null,   // Admin override — no computed score
        status: 'PENDING',
      },
    });

    // 3. Write override metadata to trace
    await tx.leadRoutingTrace.upsert({
      where: { leadId_vendorId: { leadId, vendorId } },
      create: {
        leadId,
        vendorId,
        score: 0,
        scoreFactors: {},
        selected: true,
        skipReason: null,
        overriddenAt: new Date(),
        overriddenBy: adminId,
        overrideReason: reason ?? 'Admin override',
      },
      update: {
        selected: true,
        overriddenAt: new Date(),
        overriddenBy: adminId,
        overrideReason: reason ?? 'Admin override',
      },
    });

    return { success: true, leadId, overrideVendorId: vendorId };
  });
}
```

### Pattern 6: Market Status Management

**What:** Admin updates a Market's status (PLANNED → ACTIVE → PAUSED → DECOMMISSIONED) to control which cities are live for lead routing.

**When to use:** Admin market management endpoint `PATCH /admin/markets/:marketId/status`.

```typescript
// Source: Existing Market model in schema.prisma
// Market.status is a string field — current values: 'PLANNED' (default)
// Phase 7 adds: 'ACTIVE' | 'PAUSED' | 'DECOMMISSIONED'

async updateMarketStatus(marketId: string, status: string) {
  const VALID_STATUSES = ['PLANNED', 'ACTIVE', 'PAUSED', 'DECOMMISSIONED'];
  if (!VALID_STATUSES.includes(status)) {
    throw new BadRequestException(`Invalid status: ${status}`);
  }

  return this.prisma.market.update({
    where: { id: marketId },
    data: { status, launchDate: status === 'ACTIVE' ? new Date() : undefined },
  });
}

async listMarkets() {
  return this.prisma.market.findMany({
    orderBy: { city: 'asc' },
    include: {
      _count: { select: { serviceAreas: true } },
    },
  });
}
```

### Anti-Patterns to Avoid

- **Writing trace data before assignments:** Write LeadRoutingTrace only after assignments are committed. If assignment creation fails, do not write traces (the routing event did not complete).
- **Using $queryRaw for groupBy:** Prisma's `groupBy` is type-safe and handles most analytics aggregations. Use `$queryRaw` only for operations groupBy cannot express (e.g., date_trunc time-series bucketing by hour).
- **Building materialized views preemptively:** Materialized views require raw SQL, manual REFRESH scheduling (via BullMQ cron or PostgreSQL pg_cron), and Prisma cannot apply them via migrations. Do not add this complexity unless 24h query benchmarks exceed 2 seconds in production with real data volumes.
- **Returning scores without factor breakdown:** The audit log must show WHY a vendor got their score, not just the final number. Storing `scoreFactors` as JSON in `LeadRoutingTrace` satisfies this without schema migration for factor changes.
- **Overriding routing by deleting assignments:** Use `updateMany` with status filter (optimistic concurrency pattern) to cancel existing assignments, not hard deletes. Deleted assignments would make history invisible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Revenue aggregation by type | Custom SQL joins | `prisma.transaction.groupBy({ by: ['type'], _sum: { amountPaise: true } })` | Prisma groupBy is type-safe, handles NULL sums, and compiles to efficient SQL |
| Lead status funnel counts | Multi-query count per status | Single `groupBy({ by: ['status'], _count: true })` | One query vs five; same result |
| Time-windowed query filtering | date_trunc in application | `where: { createdAt: { gte: since } }` on indexed `createdAt` fields | All six relevant tables already have `@@index([createdAt])` or implicit index via `@default(now())` and PK ordering |
| Concurrent assignment cancellation | Soft-delete with custom flag | `updateMany({ where: { status: { in: ['PENDING', 'NOTIFIED'] } } })` | Optimistic pattern with status filter prevents race conditions |
| Real-time fairness data in trace | Separate Redis query service | Direct `this.redis.get(fairness:vendorId)` in RoutingService (already has RedisService injected) | Pattern already established in RoutingService |

**Key insight:** This phase is primarily about surfacing data that already exists. The main new artifact is `LeadRoutingTrace` (schema + trace writes). Everything else is query logic over existing models.

## Common Pitfalls

### Pitfall 1: Trace Data Not Written When No Vendors Found

**What goes wrong:** When `findVendorsInRange` returns empty, `routeTopThree` returns early. No trace is written. Admin sees no routing audit log for the lead and cannot diagnose why no vendors were selected.
**Why it happens:** Early-return guard in `routeTopThree` (line 116-123 in current code).
**How to avoid:** Write a trace row with `selected: false, skipReason: 'NO_VENDORS'` before each early return. If `vendorIds.length === 0`, write one trace row with `vendorId = null` would require nullable FK — instead log a `LeadRoutingTrace` with a sentinel or log to `AdminNotification`. Better: create one row per discovered vendor (even if zero) is impossible without vendorIds. Use an admin notification for the zero-vendor case.
**Warning signs:** Leads stuck in ROUTING status with no corresponding trace rows.

### Pitfall 2: scoreVendors Returns Only Score, Not Factors

**What goes wrong:** Current `ScoringService.scoreVendors` returns `{ vendorId, score }`. To write `scoreFactors` to `LeadRoutingTrace`, the service must also return the `VendorScoreFactors` object that was used to compute the score.
**Why it happens:** `getScoreFactors` is called, passed to `computeScore`, but the factors object is discarded — only the numeric score is returned.
**How to avoid:** Modify `scoreVendors` return type to `Array<{ vendorId: string; score: number; factors: VendorScoreFactors }>`. This is a small, additive change. The `VendorScoreFactors` interface already exists in `lead/types/vendor-score.interface.ts`.
**Warning signs:** `scoreFactors` column in `lead_routing_traces` is always `{}` or null.

### Pitfall 3: Analytics Query Performance on Unfiltered Leads Table

**What goes wrong:** `Lead` table grows large over time. `groupBy({ by: ['city'], where: { createdAt: { gte: since } } })` without an index on `createdAt` degrades to a full table scan.
**Why it happens:** The Lead model currently has `@@index([customerId])`, `@@index([status])`, `@@index([categoryId])` but NO `@@index([createdAt])`.
**How to avoid:** Add `@@index([createdAt])` to the Lead model in the Phase 7 migration. Same check: Transaction model already has `@@index([createdAt])`. LeadAssignment has no `createdAt` index — add if needed. The 24h window filter is the primary analytics filter; it must hit an index.
**Warning signs:** Dashboard endpoint takes >500ms; `EXPLAIN ANALYZE` shows Seq Scan on leads.

### Pitfall 4: Manual Override Doesn't Notify the Override Vendor

**What goes wrong:** Admin overrides routing by creating a new assignment, but the override vendor never receives a push notification or Socket.IO event because the notification code is in `RoutingService`, not in `AdminService`.
**Why it happens:** `AdminService` does not have access to `NotificationService` or `InboxGateway`.
**How to avoid:** Import `RoutingModule` (or `NotificationModule` + `InboxModule`) into `AdminModule`. After creating the override assignment, call `notificationService.sendPushToVendor` for the override vendor. Alternatively, call `RoutingService.routeDirect` after updating `lead.targetVendorId` — but this risks re-running the BullMQ queue. Safer: inject NotificationService directly into AdminService for the override notification.
**Warning signs:** Vendor never responds to override-assigned lead; no push notification in logs.

### Pitfall 5: Market Status Not Checked During Lead Routing

**What goes wrong:** A market is set to PAUSED but leads in that city continue to be routed because `ScoringService.findVendorsInRange` does not filter by market status.
**Why it happens:** The current `findVendorsInRange` query joins `markets` table but does not filter on `m.status`.
**How to avoid:** Add `AND m.status = 'ACTIVE'` to the `findVendorsInRange` raw SQL. This is the "city expansion gate" from the phase description. When a market is ACTIVE, routing flows normally. When PAUSED or PLANNED, no vendors are found → lead is unrouted.
**Warning signs:** Leads routing to vendors in paused cities.

### Pitfall 6: Circular Dependency if RoutingModule Imports AdminModule

**What goes wrong:** AdminService needs RoutingService for override notifications. RoutingModule already uses LeadModule. If AdminModule imports RoutingModule which imports LeadModule which imports anything that touches admin, circular dependency error at startup.
**Why it happens:** NestJS module dependency graph must be a DAG.
**How to avoid:** Do NOT import RoutingModule into AdminModule. Instead, inject only `NotificationService` and `InboxGateway` into AdminService (both are lightweight modules). AdminService handles the DB work; notification is a fire-and-forget after the transaction commits.
**Warning signs:** `Nest cannot create the AdminModule instance` circular dependency error at startup.

### Pitfall 7: Overriding a Lead That Already Has a Booking

**What goes wrong:** Admin overrides routing on a lead that's already BOOKED or COMPLETED. New assignment is created, vendor is notified about a lead that's already closed.
**Why it happens:** No guard on lead status in the override endpoint.
**How to avoid:** In `overrideRouting`, check `lead.status` before proceeding. Reject override if status is BOOKED, COMPLETED, or CANCELLED. Only allow override for PENDING, ROUTING, ROUTED, NOTIFIED states.
**Warning signs:** Vendor confusion — receiving lead notification for an event that's already booked.

## Code Examples

Verified patterns from official sources and existing codebase:

### Prisma Migration: LeadRoutingTrace + Lead.createdAt Index

```prisma
// Source: Existing schema conventions (api/prisma/schema.prisma)
// Add to schema.prisma:

model LeadRoutingTrace {
  id             String        @id @default(uuid()) @db.Uuid
  leadId         String        @map("lead_id") @db.Uuid
  vendorId       String        @map("vendor_id") @db.Uuid
  score          Float
  scoreFactors   Json          @map("score_factors")
  selected       Boolean       @default(false)
  skipReason     String?       @map("skip_reason") @db.VarChar(30)
  overriddenAt   DateTime?     @map("overridden_at")
  overriddenBy   String?       @map("overridden_by") @db.Uuid
  overrideReason String?       @map("override_reason") @db.Text
  createdAt      DateTime      @default(now()) @map("created_at")

  lead           Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  vendor         VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@unique([leadId, vendorId])
  @@index([leadId])
  @@index([vendorId])
  @@map("lead_routing_traces")
}

// Modify Lead model — add index and relation:
//   @@index([createdAt])         ← NEW: required for analytics time-window queries
//   routingTraces LeadRoutingTrace[]   ← NEW: back-relation

// Modify VendorProfile model — add relation:
//   routingTraces LeadRoutingTrace[]   ← NEW: back-relation
```

### ScoringService: Extended Return Type

```typescript
// Source: api/src/lead/scoring.service.ts + api/src/lead/types/vendor-score.interface.ts
// Modify scoreVendors return type:

async scoreVendors(
  vendorIds: string[],
  eventLat: number,
  eventLng: number,
): Promise<Array<{ vendorId: string; score: number; factors: VendorScoreFactors }>> {
  const scored = await Promise.all(
    vendorIds.map(async (vendorId) => {
      const factors = await this.getScoreFactors(vendorId, eventLat, eventLng);
      const score = this.computeScore(factors);
      return { vendorId, score, factors };   // factors now included
    }),
  );

  return scored.sort((a, b) => b.score - a.score);
}
```

### RoutingService: Trace Write After routeTopThree

```typescript
// Source: api/src/routing/routing.service.ts — append at end of routeTopThree
// After the notification loop completes:

const selectedVendorIds = new Set(selected.map((s) => s.vendorId));

await this.prisma.leadRoutingTrace.createMany({
  data: scored.map((entry) => {
    const isSelected = selectedVendorIds.has(entry.vendorId);
    let skipReason: string | null = null;

    if (!isSelected) {
      const isAtCap = fairnessCounts.get(entry.vendorId) >= MAX_LEADS_PER_WINDOW;
      skipReason = isAtCap ? 'FAIRNESS_CAP' : 'TOP_N_LIMIT';
    }

    return {
      leadId,
      vendorId: entry.vendorId,
      score: entry.score,
      scoreFactors: entry.factors as any,  // Prisma Json type
      selected: isSelected,
      skipReason,
    };
  }),
  skipDuplicates: true,  // Idempotent in case of retry
});
```

### AdminService: Full Dashboard Query

```typescript
// Source: Prisma aggregation docs + existing AdminService patterns
async getAnalyticsDashboard() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [leadsPerCity, funnelCounts, revenueByStream, activeVendors] =
    await Promise.all([
      this.prisma.lead.groupBy({
        by: ['city'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
        orderBy: { _count: { id: 'desc' } },
      }),

      this.prisma.lead.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      }),

      this.prisma.transaction.groupBy({
        by: ['type'],
        _sum: { amountPaise: true, commissionPaise: true },
        _count: { id: true },
        where: { status: 'PAID', createdAt: { gte: since } },
      }),

      this.prisma.vendorProfile.count({
        where: {
          status: 'APPROVED',
          subscription: { status: { in: ['ACTIVE', 'AUTHENTICATED'] } },
        },
      }),
    ]);

  // Normalize funnel into ordered array
  const FUNNEL_ORDER = ['PENDING', 'ROUTING', 'ROUTED', 'NOTIFIED', 'QUOTES_RECEIVED', 'BOOKED', 'COMPLETED'];
  const funnelMap = Object.fromEntries(
    funnelCounts.map((f) => [f.status, f._count.id]),
  );

  return {
    window: { from: since, to: new Date() },
    leadsPerCity: leadsPerCity.map((r) => ({ city: r.city, count: r._count.id })),
    conversionFunnel: FUNNEL_ORDER.map((status) => ({
      status,
      count: funnelMap[status] ?? 0,
    })),
    revenueByStream: revenueByStream.map((r) => ({
      type: r.type,
      count: r._count.id,
      totalAmountPaise: r._sum.amountPaise ?? 0,
      totalCommissionPaise: r._sum.commissionPaise ?? 0,
    })),
    activeVendorCount: activeVendors,
  };
}
```

### findVendorsInRange: Add Market Status Gate

```sql
-- Source: api/src/lead/scoring.service.ts (existing $queryRaw)
-- Add AND m.status = 'ACTIVE' to both queries:

SELECT DISTINCT vsa.vendor_id
FROM vendor_service_areas vsa
JOIN markets m ON m.id = vsa.market_id
JOIN vendor_profiles vp ON vp.id = vsa.vendor_id
JOIN vendor_subscriptions vs ON vs.vendor_id = vp.id
WHERE ST_DWithin(
  ST_MakePoint(m.longitude, m.latitude)::geography,
  ST_MakePoint(${longitude}, ${latitude})::geography,
  vsa.radius_km * 1000
)
AND vp.status = 'APPROVED'
AND vs.status IN ('ACTIVE', 'AUTHENTICATED')
AND m.status = 'ACTIVE'     -- NEW: market density gate
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate analytics DB / read replica | Indexed queries on primary DB with time-window filters | Current (low volume) | Sufficient for MVP; add read replica or materialized views when query latency exceeds 2 seconds in production |
| Prisma views (Preview) for analytics | $queryRaw + groupBy with createdAt index | Prisma 6.x | Views are still Preview; cannot be applied via db push without manual SQL; groupBy is production-ready |
| Prisma batch transaction `$transaction([])` | Interactive `$transaction(async tx => ...)` for override logic | Prisma 2.29+ | Batch API cannot do conditional checks; interactive supports check + write in same transaction |
| Store audit log externally (ELK, Datadog) | LeadRoutingTrace table in PostgreSQL | N/A | External logging is expensive and latency-sensitive; PostgreSQL is sufficient for admin-facing audit queries at this scale |

**Deprecated/outdated:**
- `prisma.leadRoutingTrace.createMany` with individual await per row: Use `createMany` with array to minimize round-trips.
- Materialized view with pg_cron for dashboard refresh: Not needed at current scale (< 10k leads/month in Surat + Ahmedabad). Premature optimization.

## Open Questions

1. **Conversion rate definition for "inquiry to booking"**
   - What we know: Lead has status progression PENDING → ROUTED → NOTIFIED → QUOTES_RECEIVED → BOOKED → COMPLETED
   - What's unclear: The success criterion says "conversion rates (inquiry to booking)" — this could mean (a) leads that reached BOOKED / total leads, or (b) leads that received at least one quote / total leads (quote conversion rate)
   - Recommendation: Report both: `bookingConversionRate = bookedCount / totalLeads` and `quoteConversionRate = quotesReceivedCount / routedLeads`. Admin can interpret. No additional schema needed — both derivable from groupBy status counts.

2. **24h window vs. rolling 24h**
   - What we know: Success criterion says "data reflects activity from the previous 24 hours"
   - What's unclear: Whether "last 24 hours" means since midnight (calendar day) or rolling 24h from now
   - Recommendation: Use rolling 24h (`new Date(Date.now() - 86400000)`) as it's simpler and always current. Admin can optionally pass `dateFrom`/`dateTo` to override.

3. **Admin override notification: which service sends it?**
   - What we know: AdminModule does not currently import NotificationModule or InboxModule
   - What's unclear: Best way to inject notification capability without creating circular dependency
   - Recommendation: Add `NotificationModule` to `AdminModule` imports. `NotificationService` is a standalone service with no dependencies on AdminModule — safe to import. Skip InboxGateway (Socket.IO) for override notifications; push notification (FCM) is sufficient.

4. **Scoring trace for Mode A (direct routing) leads**
   - What we know: Mode A (`routeDirect`) routes directly to a single vendor; no scoring occurs
   - What's unclear: Should Mode A writes also create a `LeadRoutingTrace` row?
   - Recommendation: Yes — write one trace row with `score = null`, `scoreFactors = {}`, `selected = true`, `skipReason = null` to indicate direct routing. This makes the audit log complete for all leads regardless of routing mode. Update the model to allow `score Float?` (nullable).

5. **Market status on existing Surat/Ahmedabad markets**
   - What we know: Markets table exists; `status` defaults to `'PLANNED'`; current markets were seeded in Phase 1
   - What's unclear: Current status value for Surat and Ahmedabad markets in the database
   - Recommendation: Add a data migration (or seed script update) to set Surat and Ahmedabad markets to `'ACTIVE'` status. Without this, the `AND m.status = 'ACTIVE'` filter in `findVendorsInRange` would break all existing routing. This is a critical migration step.

## Sources

### Primary (HIGH confidence)
- `/Users/mac/Desktop/zavento/api/src/routing/routing.service.ts` — Full routing implementation read; scoring flow and fairness cap logic verified
- `/Users/mac/Desktop/zavento/api/src/lead/scoring.service.ts` — ScoringService implementation; `scoreVendors` return type verified as `{ vendorId, score }` (factors discarded)
- `/Users/mac/Desktop/zavento/api/prisma/schema.prisma` — All existing models, indexes, and relations verified; confirmed Lead has no `createdAt` index; Market status field verified
- `/Users/mac/Desktop/zavento/api/src/admin/admin.service.ts` + `admin.controller.ts` — Existing admin patterns; groupBy usage in `getReconciliation()` verified
- [Prisma aggregation docs](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing) — groupBy API with _sum, _count, where, having verified

### Secondary (MEDIUM confidence)
- [Prisma views documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/views) — Views are Preview; materialized views not natively supported; `$queryRaw` is the path for materialized view refresh
- [Wanago: Aggregating statistics with PostgreSQL and Prisma](https://wanago.io/2023/11/20/api-nestjs-aggregating-postgresql-prisma/) — groupBy patterns with filtering verified against Prisma docs
- [PostgreSQL GROUP BY performance guide](https://oneuptime.com/blog/post/2026-01-25-postgresql-group-by-performance/view) — Index recommendations for date-range GROUP BY; verified by existing project pattern (Transaction has `@@index([createdAt])`)

### Tertiary (LOW confidence)
- WebSearch: PostgreSQL materialized views with BullMQ refresh patterns — found no authoritative source; materialized views deferred to post-MVP performance optimization
- WebSearch: NestJS admin analytics funnel patterns — general pattern guidance only; specific code derived from codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new libraries; all tools are already installed and in active use in the codebase
- Architecture: HIGH — `LeadRoutingTrace` model follows exact existing schema conventions; admin endpoint additions follow existing AdminService/AdminController patterns
- Analytics queries: HIGH — Prisma groupBy API verified against official docs; existing `getReconciliation()` in AdminService already demonstrates the groupBy pattern
- Routing trace modification: HIGH — `ScoringService.scoreVendors` return type change is small and additive; trace write pattern derived directly from existing code structure
- Pitfalls: HIGH — derived from reading actual service code (early-return guards, missing indexes, module dependency graph); not speculative
- Market status gate: HIGH — `findVendorsInRange` SQL read directly; adding `AND m.status = 'ACTIVE'` is a single-line change
- Migration risk: MEDIUM — Surat/Ahmedabad markets must be updated to ACTIVE status or all routing breaks; this is a known data migration requirement

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days — stable stack, no fast-moving dependencies)
