# Architecture Research

**Domain:** Multi-sided event marketplace (lead generation + service booking + B2B product sales)
**Researched:** 2026-03-04
**Confidence:** MEDIUM — based on established marketplace architecture patterns (Urban Company, IndiaMART, Thumbtack, Airbnb); WebSearch/WebFetch unavailable; flagged where confidence drops.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Customer    │  │  Planner /   │  │   Supplier   │  │   Admin    │  │
│  │  Web App     │  │  Decorator   │  │   Portal     │  │   Panel    │  │
│  │  (Next.js)   │  │  Dashboard   │  │  (Next.js)   │  │  (Next.js) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
└─────────┼─────────────────┼─────────────────┼────────────────┼──────────┘
          │                 │                 │                │
┌─────────▼─────────────────▼─────────────────▼────────────────▼──────────┐
│                        API GATEWAY (NestJS REST API)                      │
│   Route guard → Role check → Rate limit → Request dispatch                │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┘
       │          │          │          │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼───┐ ┌───▼────────────┐
│  Auth   │ │  Lead   │ │Booking │ │ B2B    │ │Vendor │ │  Notification  │
│ Module  │ │ Module  │ │ Module │ │ Order  │ │  CRM  │ │    Module      │
│         │ │(Routing │ │        │ │ Module │ │ Module│ │  (Firebase)    │
│OTP,JWT  │ │ Engine) │ │        │ │        │ │       │ │                │
└────┬────┘ └────┬────┘ └───┬────┘ └───┬────┘ └───┬───┘ └───────────────┘
     │           │          │          │          │
┌────▼───────────▼──────────▼──────────▼──────────▼──────────────────────┐
│                         DATA LAYER                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │  Cloudinary  │  │  Firebase  │  │
│  │  (primary)   │  │  (sessions,  │  │  (media /    │  │  (push     │  │
│  │              │  │   scoring    │  │   product     │  │  notifs)   │  │
│  │              │  │   cache)     │  │   images)    │  │            │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| API Gateway | Single entry point, JWT validation, role enforcement, rate limiting | NestJS with Guards + Interceptors |
| Auth Module | OTP send/verify, JWT issue, role assignment, session management | NestJS + Twilio/MSG91 + Redis OTP store |
| Lead Module | Lead creation triggers, consent tracking, routing engine, Top 3 scoring | NestJS service with scoring algorithm |
| Booking Module | Booking workflows, calendar management, commission calculation | NestJS + date/calendar logic |
| B2B Order Module | Product catalog, cart, order management, fulfillment tracking | NestJS + PostgreSQL |
| Vendor CRM Module | Lead dashboard, quote generation, response tracking, analytics | NestJS + PostgreSQL |
| Subscription Module | Plan management, billing, tier enforcement for routing score | NestJS + Razorpay webhooks |
| Payment Module | Razorpay integration, lead purchase, commission settlement | NestJS + Razorpay SDK |
| Notification Module | Push (Firebase), SMS triggers for leads and bookings | NestJS + Firebase Admin SDK |
| Admin Module | Vendor approval, routing config, analytics, payout management | NestJS + separate admin routes |

---

## Recommended Project Structure

This is a monorepo with a modular monolith API — not microservices. Reasoning: at 500-5,000 vendors, a monolith is operationally simpler; module boundaries are clean enough to extract later if needed.

```
zevento-pro/
├── apps/
│   ├── web/                    # Next.js — customer-facing
│   │   ├── app/                # App Router pages
│   │   ├── components/
│   │   └── lib/                # API client, auth helpers
│   ├── vendor/                 # Next.js — planner/supplier portal
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── admin/                  # Next.js — admin panel
│       ├── app/
│       ├── components/
│       └── lib/
├── packages/
│   └── shared/                 # Shared types, enums, constants
│       ├── types/              # Zod schemas and TypeScript types
│       └── constants/          # Role names, status enums
├── api/                        # NestJS monolith
│   ├── src/
│   │   ├── auth/               # OTP auth, JWT, guards
│   │   ├── leads/              # Lead creation, routing engine, scoring
│   │   ├── bookings/           # Booking workflows, calendar
│   │   ├── vendors/            # Vendor profiles, CRM, quotes
│   │   ├── products/           # B2B catalog, inventory
│   │   ├── orders/             # B2B order lifecycle
│   │   ├── subscriptions/      # Plans, billing, tier management
│   │   ├── payments/           # Razorpay, commissions, settlements
│   │   ├── notifications/      # Firebase push, SMS
│   │   ├── analytics/          # Vendor + admin dashboards
│   │   ├── admin/              # Admin controls and approvals
│   │   ├── common/             # Shared guards, decorators, pipes
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma       # Single source of truth for DB schema
│   └── test/
├── docker-compose.yml          # Local: postgres + redis
└── package.json                # Monorepo root (pnpm workspaces)
```

### Structure Rationale

- **api/src/leads/:** The lead routing engine is the critical system path. Isolated module ensures scoring logic changes don't cascade.
- **api/src/vendors/:** Vendor CRM and profile management are high-churn development areas — keep isolated from lead routing.
- **api/src/subscriptions/ vs api/src/payments/:** Subscriptions are recurring billing state; payments are transaction events. Different lifecycles = separate modules.
- **apps/vendor/ vs apps/web/:** Different user roles have radically different UX. Separate Next.js apps share a common API but avoid code coupling.
- **packages/shared/:** Zod schemas shared between API (for validation) and frontends (for type safety) prevents drift without a formal tRPC layer.

---

## Architectural Patterns

### Pattern 1: Modular Monolith with Domain Modules

**What:** A single deployable API service organized into strictly-bounded domain modules that do not import from each other's internals — only through well-defined service interfaces.

**When to use:** Always at this scale (v1 → Phase 2). Microservices at 500 vendors is operational over-engineering. Extract a module into its own service only when a specific domain's load profile diverges dramatically.

**Trade-offs:** Simpler ops, shared DB (fast joins); coupling risk if boundaries aren't respected. Use NestJS module boundaries as the enforcer.

```typescript
// CORRECT: Lead module calls Vendor service via injected interface
// api/src/leads/leads.service.ts
@Injectable()
export class LeadsService {
  constructor(
    private readonly vendorService: VendorsService,   // injected — no direct import of vendor internals
    private readonly scoringService: ScoringService,
    private readonly notificationService: NotificationsService,
  ) {}

  async routeLead(leadId: string): Promise<RoutedLead> {
    const lead = await this.leadsRepository.findById(leadId);
    const candidates = await this.vendorService.findCandidates(lead.categoryId, lead.cityId);
    const scored = await this.scoringService.scoreAndRank(candidates, lead);
    const top3 = scored.slice(0, 3);
    await this.notificationService.notifyVendors(top3, lead);
    return { lead, assignedVendors: top3 };
  }
}
```

### Pattern 2: Event-Driven Lead Lifecycle with Domain Events

**What:** Lead state transitions (created → routed → accepted → quoted → booked → closed) are emitted as domain events that other modules subscribe to, rather than direct method calls.

**When to use:** For the lead routing → notification → analytics pipeline. Decouples the routing engine from downstream consumers.

**Trade-offs:** Testable, loosely coupled; adds indirection. At this scale, use NestJS EventEmitter (in-process) — not Kafka or RabbitMQ. Message queues only when load genuinely demands async processing.

```typescript
// api/src/leads/events/lead-routed.event.ts
export class LeadRoutedEvent {
  constructor(
    public readonly leadId: string,
    public readonly assignedVendorIds: string[],
    public readonly routingMode: 'SINGLE' | 'TOP_3',
    public readonly timestamp: Date,
  ) {}
}

// api/src/notifications/notifications.listener.ts
@Injectable()
export class NotificationsListener {
  @OnEvent('lead.routed')
  async handleLeadRouted(event: LeadRoutedEvent) {
    await this.pushService.sendToVendors(event.assignedVendorIds, {
      type: 'NEW_LEAD',
      leadId: event.leadId,
    });
  }
}
```

### Pattern 3: Role-Based Guard + Resource Ownership Check

**What:** Every API route enforces two gates: (1) role check (is the caller a Planner? Supplier? Admin?) and (2) ownership check (does this Planner own this lead/booking/quote?).

**When to use:** Every protected endpoint. Missing ownership checks are the #1 security failure in marketplace APIs.

**Trade-offs:** Slightly more boilerplate; eliminates an entire class of IDOR vulnerabilities.

```typescript
// api/src/common/decorators/roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// api/src/common/guards/ownership.guard.ts
@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id;
    // Admins bypass ownership checks
    if (user.role === Role.ADMIN) return true;
    // Vendor must own the resource
    return this.resourceService.isOwnedBy(resourceId, user.id);
  }
}

// Usage on controller
@Get(':id')
@Roles(Role.PLANNER, Role.SUPPLIER, Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard, ResourceOwnerGuard)
async getLead(@Param('id') id: string) { ... }
```

### Pattern 4: Vendor Scoring as a Pure Computation Service

**What:** The scoring algorithm is a stateless, deterministic function: `score(vendor, lead) → number`. It reads from a pre-computed vendor score cache (Redis) for performance.

**When to use:** Always. The scoring formula (Subscription Tier 30%, Rating 20%, Response Rate 20%, Distance 20%, Fairness Rotation 10%) must be testable in isolation and auditable by admin.

**Trade-offs:** Redis cache adds an infrastructure dependency but makes Top 3 routing sub-100ms. Without cache, DB joins on every lead creation won't scale past 100 leads/day.

```typescript
// api/src/leads/scoring/scoring.service.ts
@Injectable()
export class ScoringService {
  WEIGHTS = {
    subscriptionTier: 0.30,
    rating: 0.20,
    responseRate: 0.20,
    locationMatch: 0.20,
    fairnessRotation: 0.10,
  };

  scoreVendor(vendor: VendorScoreFactors, lead: Lead): number {
    const tierScore = this.tierToScore(vendor.subscriptionTier);    // 0-100
    const ratingScore = (vendor.averageRating / 5) * 100;           // 0-100
    const responseScore = vendor.responseRate * 100;                 // 0-100
    const locationScore = vendor.cityId === lead.cityId ? 100 : 0;  // binary for v1
    const fairnessScore = this.fairnessScore(vendor.lastLeadAt);    // 0-100

    return (
      tierScore * this.WEIGHTS.subscriptionTier +
      ratingScore * this.WEIGHTS.rating +
      responseScore * this.WEIGHTS.responseRate +
      locationScore * this.WEIGHTS.locationMatch +
      fairnessScore * this.WEIGHTS.fairnessRotation
    );
  }
}
```

---

## Data Flow

### Lead Creation and Routing Flow (Critical Path)

```
Customer fills enquiry form
    │
    ▼
POST /leads (with explicit consent checkbox = true)
    │
    ▼
Auth Guard → Consent validation → Lead created in DB (status: PENDING)
    │
    ▼
ScoringService.rankVendors(lead.categoryId, lead.cityId)
    │   ├── Pulls candidate vendors from DB (matching category + city + active subscription)
    │   ├── Fetches cached score factors from Redis (tier, rating, responseRate)
    │   └── Computes weighted score for each → sort → take Top 3
    │
    ▼
Lead.status → ROUTED, assignedVendorIds saved
    │
    ▼
EventEmitter: 'lead.routed' published
    │   ├── NotificationsListener → Firebase push to each assigned vendor
    │   ├── AnalyticsListener → increment lead metrics (admin dashboard)
    │   └── BillingListener → debit lead credits or charge lead purchase fee
    │
    ▼
Vendor receives notification → opens CRM dashboard
    │
    ▼
Vendor views lead (phone revealed only after viewing = consent gate)
    │
    ▼
Vendor submits quote → BookingModule creates quote record
    │
    ▼
Customer accepts quote → BookingModule creates Booking (status: CONFIRMED)
    │
    ▼
Payment processed → CommissionService calculates 5-10% platform fee
    │
    ▼
Booking.status → COMPLETED → Vendor rating prompt triggered
```

### Authentication Flow

```
User enters phone number
    │
    ▼
POST /auth/otp/send → MSG91 API → OTP stored in Redis (TTL: 10 min)
    │
    ▼
User submits OTP
    │
    ▼
POST /auth/otp/verify → Redis lookup → OTP match
    │
    ▼
User record created/fetched → Role resolved (Customer/Planner/Supplier/Admin)
    │
    ▼
JWT issued (accessToken: 15min, refreshToken: 30 days stored in Redis)
    │
    ▼
Client stores JWT → attaches to all subsequent API requests as Bearer token
```

### B2B Order Flow

```
Supplier lists product (catalog: name, SKU, price, MOQ, images → Cloudinary)
    │
    ▼
Customer/Planner browses catalog → adds to cart (Redis cart session)
    │
    ▼
Checkout → POST /orders → Order record created (status: PENDING_PAYMENT)
    │
    ▼
Razorpay payment link created → User completes payment
    │
    ▼
Razorpay webhook → POST /payments/webhook → Order.status → CONFIRMED
    │
    ▼
Supplier notified → fulfillment begins → status updates (SHIPPED, DELIVERED)
    │
    ▼
Platform margin captured (product price - supplier cost = margin to Zevento)
```

### Subscription and Score Cache Invalidation Flow

```
Vendor upgrades/downgrades subscription plan
    │
    ▼
SubscriptionService updates vendor.subscriptionTier in DB
    │
    ▼
Redis cache for vendor's score factors invalidated
    │
    ▼
Next lead routing call recomputes score from fresh DB read → re-caches
```

---

## Key Data Model Relationships

```
User (role: Customer | Planner | Supplier | Admin)
  │
  ├──< VendorProfile (Planner or Supplier, city, categories, subscription)
  │       │
  │       ├──< VendorCategory (many-to-many: category tags)
  │       ├──< LeadAssignment (which leads this vendor received)
  │       ├──< Quote (quotes submitted to customers)
  │       └──< Booking (confirmed bookings)
  │
  └──< Lead (created by Customer or via ad)
          │
          ├── Category (decoration, DJ, catering...)
          ├── City
          ├── ConsentRecord (phone consent, data consent, timestamp)
          └──< LeadAssignment → VendorProfile (Top 3)

Product (owned by Supplier)
  └──< OrderItem

Order (placed by Customer or Planner)
  ├──< OrderItem → Product
  └── Payment

Subscription
  ├── Plan (PLANNER_BASIC | PLANNER_PRO | SUPPLIER_BASIC | SUPPLIER_PRO)
  └── BillingCycle → Payment
```

---

## Component Communication Map

| From | To | Method | Notes |
|------|----|--------|-------|
| Client Apps | API Gateway | HTTPS REST (JSON) | All external traffic |
| Auth Module | Redis | Direct client call | OTP store, session store |
| Auth Module | MSG91 | HTTP REST | OTP SMS delivery |
| Lead Module | Vendor Module | NestJS service injection | Get scoring candidates |
| Lead Module | Scoring Service | Direct call (same module) | Pure function, in-process |
| Lead Module | EventEmitter | In-process events | Decouple routing from notifications |
| Notification Module | Firebase Admin SDK | HTTP | Push notifications to vendor app |
| Payment Module | Razorpay | HTTPS + webhook | Payment initiation and confirmation |
| Subscription Module | Razorpay | HTTPS + webhook | Recurring billing (Razorpay Subscriptions) |
| Order Module | Cloudinary | HTTPS | Product image upload/serve |
| Analytics Module | PostgreSQL | Direct read (read-only replica for Phase 2) | Dashboard aggregations |
| All Modules | PostgreSQL | Prisma ORM | Primary data store |
| Lead Module | Redis | Cache read/write | Vendor score factor cache |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 vendors / 100 leads/day | Monolith + single Postgres + Redis. No queues needed. Vertical scaling on server. |
| 500-5,000 vendors / 1,000 leads/day | Add Postgres read replica for analytics queries. Redis cluster for session + score cache. CDN for static assets. Consider BullMQ job queue for notification dispatch. |
| 5,000-30,000 vendors / 10,000 leads/day | Extract Lead Routing as a separate service (highest load domain). Add BullMQ for async lead routing jobs. Consider partitioning by city/region in DB. Potential ElasticSearch for vendor discovery. |

### Scaling Priorities

1. **First bottleneck: Lead routing DB queries.** The scoring query (find all eligible vendors by category + city + active subscription) hits the DB on every lead creation. Fix: Redis cache for vendor score factors, invalidated on subscription/rating change. This must be built in Phase 1.
2. **Second bottleneck: Analytics dashboard queries.** Admin and planner analytics run heavy aggregations. Fix: Postgres read replica + materialized views for dashboard metrics. Phase 2 concern.
3. **Third bottleneck: Notification fan-out.** At 10,000 leads/day, Firebase push to 3 vendors per lead = 30,000 push calls/day. Fix: BullMQ queue for async dispatch. Phase 2/3 concern.

---

## Anti-Patterns

### Anti-Pattern 1: Building Microservices from Day One

**What people do:** Split lead routing, vendor CRM, orders, and notifications into separate services with their own databases from the start.

**Why it's wrong:** At 500 vendors, this adds distributed systems complexity (network failures, distributed transactions, separate deployments) with zero benefit. The lead routing → booking → payment flow requires cross-domain consistency that's trivial in a monolith and complex with distributed sagas.

**Do this instead:** Modular monolith with strict NestJS module boundaries. When the load profile of one domain diverges (e.g., lead routing at 10,000/day), extract that one module. Not before.

### Anti-Pattern 2: Storing Lead Phone Numbers Without Consent Gate

**What people do:** Create a lead, immediately expose the customer's phone number to all 3 assigned vendors in the notification payload.

**Why it's wrong:** Violates privacy architecture, exposes PII before consent, creates liability under India's DPDP Act (Digital Personal Data Protection Act 2023). Vendors copy numbers to WhatsApp, bypassing the platform.

**Do this instead:** Lead notification to vendor contains only lead metadata (category, city, budget, event date). Phone number revealed only when vendor explicitly "accepts" lead through the platform and triggers the consent reveal API call. Log every reveal event with timestamp.

### Anti-Pattern 3: Calculating Vendor Scores On-the-Fly Without Caching

**What people do:** On each lead creation, run a SQL query joining vendors, ratings, response logs, subscription tables — computing scores live.

**Why it's wrong:** At 100 leads/day with 500 eligible vendors, this is 50,000 vendor evaluations per day. Each evaluation joins 4-5 tables. Response time for lead routing becomes a bottleneck and the most critical path in the system becomes the slowest.

**Do this instead:** Maintain a Redis hash of pre-computed score factors per vendor (`vendor:{id}:score_factors`). Recompute and invalidate only when a vendor's tier, rating, or response rate changes. Lead routing reads from cache → applies weights → sorts. Sub-10ms routing.

### Anti-Pattern 4: Single User Table with Role String

**What people do:** Store all users in one table with a `role` column (string), then bolt on role-specific fields as nullable columns.

**Why it's wrong:** Customer, Planner, and Supplier have completely different profiles, settings, and data shapes. Nullable columns on a shared table grow unboundedly. Queries become ambiguous. Vendor-specific data (subscription, service area, portfolio) doesn't belong on a user record.

**Do this instead:** `users` table holds identity only (id, phone, role, created_at). `vendor_profiles` table holds all vendor-specific data with a FK to `users`. `customer_profiles` holds customer preferences. Role determines which profile table to join, not which nullable columns to read.

### Anti-Pattern 5: Implementing AI Lead Scoring in Phase 1

**What people do:** Start with ML-based vendor scoring because it sounds better than the weighted formula.

**Why it's wrong:** AI scoring requires historical data (you have none in Phase 1), model training infrastructure, monitoring for model drift, and explainability for admin override. The weighted formula (Subscription 30%, Rating 20%, etc.) is transparent, tunable by admin, and provably fair — which is what matters for vendor trust at onboarding.

**Do this instead:** Ship the weighted formula in Phase 1. Collect data. Build ML scoring in Phase 2 or Phase 3 as a validation layer on top of the formula.

---

## Suggested Build Order (Dependency Chain)

The following order reflects hard dependencies — each phase unblocks the next.

```
Phase 1: Foundation (everything else depends on this)
├── Database schema (Prisma models: users, vendor_profiles, leads, categories, cities)
├── Auth module (OTP + JWT) — gates all protected routes
└── Multi-role middleware — every subsequent module needs this

Phase 2: Vendor Onboarding (leads need vendors to route to)
├── Vendor profile CRUD
├── Subscription module (tier determines scoring weight)
└── Admin vendor approval (vendors must be approved before receiving leads)

Phase 3: Lead Engine (core revenue driver)
├── Lead creation with consent tracking
├── Scoring service + Redis cache
├── Lead routing (Top 3 assignment)
└── Notification module (vendor push alerts)

Phase 4: Vendor CRM (vendors need tools to respond to leads)
├── Lead dashboard (assigned leads view)
├── Quote generator
└── Booking calendar

Phase 5: Booking and Payments (monetization)
├── Booking workflow (customer accepts quote → booking confirmed)
├── Razorpay integration (lead purchase, commission)
└── Commission settlement logic

Phase 6: B2B Product Marketplace (separate revenue stream)
├── Supplier product catalog
├── Cart and checkout
└── Order management + fulfillment tracking

Phase 7: Analytics and Admin
├── Admin dashboard (lead routing controls, vendor approvals, revenue)
└── Planner/Supplier analytics dashboard
```

**Why this order:**
- Auth before everything — no protected route works without it.
- Vendors before leads — the routing engine cannot assign leads if no approved vendors exist.
- Subscription before lead routing — the subscription tier is 30% of the scoring weight; routing without it means equal-tier scoring only.
- Lead engine before CRM — vendors need leads to arrive before a CRM response flow matters.
- B2B marketplace after core lead engine — separate revenue stream, but the core marketplace must be validated first.
- Analytics last — dashboards read data that the operational modules produce; build the data before the views.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| MSG91 (SMS OTP) | REST API call from Auth Module | Indian SMS gateway, TRAI-compliant, supports DLT registration required for transactional SMS |
| Razorpay (payments) | REST API + webhook POST to `/payments/webhook` | Verify webhook signature with HMAC-SHA256; never trust payload without verification |
| Razorpay Subscriptions | Razorpay Subscription Plans + webhook for billing events | For vendor recurring subscriptions (monthly) |
| Firebase Admin SDK | Server-to-server push via Firebase Cloud Messaging | Store FCM device tokens on vendor login; update on each new login |
| Cloudinary | Signed upload from server; serve via CDN URL | For product images and vendor portfolio images; never serve from your own server |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Lead Module -> Vendor Module | NestJS service injection (VendorsService.findCandidates) | One-directional: Lead depends on Vendor, not vice versa |
| Lead Module -> Notification Module | EventEmitter `lead.routed` event | Decoupled; notification failure does not fail lead routing |
| Subscription Module -> Lead Module | Vendor score cache invalidation on tier change | SubscriptionService calls ScoringCacheService.invalidate(vendorId) |
| Payment Module -> Booking Module | EventEmitter `payment.confirmed` event | Booking status update triggered by payment webhook confirmation |
| Admin Module -> All Modules | Admin reads across modules but writes only to admin-scoped resources | Admin approval writes to vendor_profiles.status; does not mutate lead or payment records directly |

---

## Sources

- Architecture patterns: MEDIUM confidence — based on documented architectures of Urban Company (formerly UrbanClap), IndiaMART, Thumbtack, and Airbnb engineering blogs (training knowledge, not live-verified)
- NestJS modular architecture: HIGH confidence — NestJS documentation patterns for module boundaries, guards, and event emitter are well-established
- Razorpay Subscriptions and Webhooks: MEDIUM confidence — Razorpay India docs are well-documented; specific webhook payload formats should be verified against https://razorpay.com/docs/
- MSG91 OTP for India: MEDIUM confidence — established pattern for Indian phone-first authentication; verify DLT registration requirements at https://msg91.com/help
- India DPDP Act data handling requirements: LOW confidence — law passed 2023, implementation rules evolving; get legal review before launch for phone consent handling
- Redis score caching pattern: HIGH confidence — standard read-through cache pattern with invalidation on write; well-established
- Firebase push via Admin SDK: HIGH confidence — standard server-side push pattern

---

*Architecture research for: Zevento Pro — Multi-sided Event Marketplace (India)*
*Researched: 2026-03-04*
