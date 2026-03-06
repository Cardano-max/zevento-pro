# Phase 3: Lead Routing Engine - Research

**Researched:** 2026-03-06
**Domain:** Lead scoring, async job processing, geospatial queries, push notifications
**Confidence:** HIGH

## Summary

Phase 3 builds three core capabilities on top of the existing NestJS API: (1) public-facing API endpoints for browsing categories, searching/filtering vendors, and viewing vendor profiles; (2) a lead creation flow gated by explicit consent; and (3) an asynchronous routing engine that scores and assigns vendors using BullMQ background jobs. The scoring algorithm uses a weighted formula across five factors, with vendor scores cached in Redis for sub-10ms lookups.

The critical technical blocker identified in STATE.md -- Prisma's lack of native PostGIS support -- is resolved by using `$queryRaw` with PostGIS functions (`ST_DWithin`, `ST_MakePoint`). The existing schema already stores latitude/longitude as Float columns on the `markets` table, and vendors link to markets via `VendorServiceArea` with `radiusKm`. This means geospatial matching can be done by comparing the customer's event city against vendor service areas using PostGIS distance calculations on the markets table directly.

The project is API-only (NestJS backend). The `apps/web` directory contains only a stub `package.json`. Plan 03-01 ("customer-facing frontend") should be implemented as REST API endpoints that a future frontend will consume, not as a Next.js frontend scaffold. This aligns with the monorepo architecture where the API is the current focus.

**Primary recommendation:** Use `@nestjs/bullmq` + `bullmq` for async job processing, `firebase-admin` for FCM push notifications, and raw `$queryRaw` with PostGIS functions for geospatial queries. Do not add a frontend framework in this phase.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/bullmq` | ^11.0.4 | NestJS integration for BullMQ queues | Official NestJS module, first-party support, extends WorkerHost pattern |
| `bullmq` | ^5.61.0 | Background job processing engine | Industry standard for Node.js job queues, built on ioredis, Redis-backed |
| `firebase-admin` | ^13.7.0 | Firebase Cloud Messaging (FCM) push notifications | Official Firebase SDK, supports FCM v1 API, production-grade |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ioredis` | ^5.4.2 | Redis client (already installed) | Score caching, BullMQ connection |
| `@prisma/client` | ^6.4.1 | Database ORM (already installed) | All DB operations except geospatial |
| `class-validator` | ^0.15.1 | DTO validation (already installed) | Inquiry form validation |
| `class-transformer` | ^0.5.1 | DTO transformation (already installed) | Request/response shaping |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | Agenda.js | Agenda uses MongoDB; project uses Redis+PostgreSQL -- BullMQ fits the stack |
| BullMQ | pg-boss | pg-boss is PostgreSQL-native but BullMQ has better NestJS integration and performance |
| Raw `$queryRaw` for PostGIS | prisma-extension-postgis | No stable npm package exists; raw SQL is the established community pattern |
| firebase-admin | OneSignal/Pusher | firebase-admin is free for FCM and well-documented with NestJS |

**Installation:**
```bash
cd api && pnpm add @nestjs/bullmq bullmq firebase-admin
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── customer/                # Plan 03-01: Public browsing APIs
│   ├── customer.module.ts
│   ├── customer.controller.ts
│   ├── customer.service.ts
│   └── dto/
│       ├── search-vendors.dto.ts
│       └── vendor-profile-response.dto.ts
├── lead/                    # Plan 03-02: Lead creation + scoring
│   ├── lead.module.ts
│   ├── lead.controller.ts
│   ├── lead.service.ts
│   ├── scoring.service.ts
│   ├── dto/
│   │   ├── create-inquiry.dto.ts
│   │   └── lead-response.dto.ts
│   └── types/
│       └── vendor-score.interface.ts
├── routing/                 # Plan 03-03: Async routing engine
│   ├── routing.module.ts
│   ├── routing.processor.ts     # BullMQ processor (extends WorkerHost)
│   ├── routing.service.ts
│   └── routing.constants.ts     # Queue names, weight constants
├── notification/            # Plan 03-03: FCM push notifications
│   ├── notification.module.ts
│   └── notification.service.ts
├── prisma/                  # Existing
├── redis/                   # Existing
├── auth/                    # Existing
├── privacy/                 # Existing (ConsentRequiredGuard)
├── vendor/                  # Existing
└── subscription/            # Existing
```

### Pattern 1: BullMQ Processor with NestJS
**What:** Background job processor for lead routing
**When to use:** All async lead routing (LEAD-05)
**Example:**
```typescript
// Source: https://docs.bullmq.io/guide/nestjs
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('lead-routing')
export class RoutingProcessor extends WorkerHost {
  constructor(
    private readonly routingService: RoutingService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<{ leadId: string; mode: 'A' | 'B' }>): Promise<void> {
    const { leadId, mode } = job.data;

    if (mode === 'A') {
      await this.routingService.routeDirect(leadId);
    } else {
      await this.routingService.routeTopThree(leadId);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    // Log failure, potentially retry or alert
  }
}
```

### Pattern 2: BullMQ Module Registration
**What:** Register BullMQ with existing Redis connection
**When to use:** AppModule setup
**Example:**
```typescript
// IMPORTANT: BullMQ needs its own connection config, cannot reuse ioredis instance
// for Workers (they need blocking connections). Use same host/port config.
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    BullModule.registerQueue({ name: 'lead-routing' }),
  ],
})
export class AppModule {}
```

### Pattern 3: Scoring Service with Redis Cache
**What:** Weighted vendor scoring with cached factors
**When to use:** LEAD-02 scoring formula
**Example:**
```typescript
interface VendorScoreFactors {
  vendorId: string;
  subscriptionTier: number;  // 0 or 1 (BASIC=0, PREMIUM=1)
  averageRating: number;     // 0-5
  responseRate: number;      // 0-1
  locationMatch: boolean;    // true/false from PostGIS
  fairnessCount: number;     // leads received in rotation window
}

// Cache key pattern: vendor:score:{vendorId}
// TTL: 300 seconds (5 minutes) -- invalidate on subscription/rating change
// Score formula:
//   score = (tier * 0.30) + (normalizedRating * 0.20) + (responseRate * 0.20)
//         + (locationMatch * 0.20) + (fairnessScore * 0.10)
```

### Pattern 4: PostGIS Distance Query via Raw SQL
**What:** Find vendors within service radius of customer's event city
**When to use:** Location matching in scoring (LEAD-02)
**Example:**
```typescript
// Source: https://alizahid.dev/blog/geo-queries-with-prisma + PostGIS docs
// Markets table has latitude/longitude Float columns
// VendorServiceArea links vendors to markets with radiusKm

const matchingVendors = await this.prisma.$queryRaw<{ vendor_id: string }[]>`
  SELECT DISTINCT vsa.vendor_id
  FROM vendor_service_areas vsa
  JOIN markets m ON m.id = vsa.market_id
  WHERE ST_DWithin(
    ST_MakePoint(m.longitude, m.latitude)::geography,
    ST_MakePoint(${eventLongitude}, ${eventLatitude})::geography,
    vsa.radius_km * 1000
  )
`;
```

### Pattern 5: Firebase Admin Initialization
**What:** Initialize Firebase Admin SDK for FCM
**When to use:** NotificationService singleton
**Example:**
```typescript
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService implements OnModuleInit {
  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async sendPushToVendor(fcmToken: string, leadData: any): Promise<void> {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'New Lead Received',
        body: `New ${leadData.eventType} inquiry in ${leadData.city}`,
      },
      data: { leadId: leadData.leadId, type: 'NEW_LEAD' },
    });
  }
}
```

### Pattern 6: Mode A vs Mode B Routing
**What:** Two routing modes based on inquiry source
**When to use:** LEAD-03 and LEAD-04
**Example:**
```typescript
// Mode A: Customer visited a specific vendor profile, then submitted inquiry
//   → Route lead to THAT vendor only (no scoring needed, just assign)
//   → The inquiry form on a vendor profile page includes vendorId

// Mode B: Customer browsed a category/did general search, then submitted inquiry
//   → Score ALL eligible vendors, pick Top 3, assign to lead
//   → The inquiry form from category/search does NOT include vendorId

// Detection: presence of targetVendorId in CreateInquiryDto
// If targetVendorId is set → Mode A
// If targetVendorId is null → Mode B
```

### Anti-Patterns to Avoid
- **Synchronous scoring in request handler:** Never compute vendor scores in the POST /inquiries endpoint. Enqueue to BullMQ and return immediately with acknowledgment.
- **Separate Redis connection per service:** BullMQ manages its own connections. Do not create additional ioredis instances for BullMQ -- use the `BullModule.forRoot` connection config.
- **Using Prisma for geospatial queries:** Prisma has zero native PostGIS support. Always use `$queryRaw` for any `ST_*` function calls.
- **Storing FCM tokens in VendorProfile:** FCM tokens change frequently. Store them in a separate table (or Redis) with device/platform info, linked to userId.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queuing | Custom Redis pub/sub queue | BullMQ via `@nestjs/bullmq` | Retries, backoff, dead letter queues, concurrency, monitoring |
| Push notifications | Custom FCM HTTP calls | `firebase-admin` SDK | Token management, error handling, batch sending, FCM v1 API |
| Geospatial distance | Haversine formula in JS | PostGIS `ST_DWithin` | Database-level spatial indexing, accurate geodesic calculations |
| Rate limiting for scoring | Custom counter logic | Redis `INCR` + `EXPIRE` (existing RedisService) | Atomic operations, TTL-based reset |
| Job monitoring | Custom admin dashboard | `@bull-board/nestjs` (optional, defer) | Visual queue monitoring, retry UI |

**Key insight:** The scoring engine is the core business logic and SHOULD be custom. Everything around it (queuing, notifications, geospatial) should use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: BullMQ maxRetriesPerRequest
**What goes wrong:** BullMQ Workers throw `"maxRetriesPerRequest" must be null` error
**Why it happens:** When passing an existing ioredis client to BullMQ Worker, ioredis defaults `maxRetriesPerRequest` to 20, but BullMQ requires it to be null for blocking commands
**How to avoid:** Use `BullModule.forRoot({ connection: { host, port } })` and let BullMQ create its own connections. Do NOT share the existing RedisService ioredis instance with BullMQ.
**Warning signs:** Runtime error on worker startup

### Pitfall 2: PostGIS Extension Not Enabled
**What goes wrong:** `ERROR: function st_dwithin(geography, geography, double precision) does not exist`
**Why it happens:** PostGIS Docker image has the extension available but it may not be enabled in the database
**How to avoid:** Run `CREATE EXTENSION IF NOT EXISTS postgis;` in a migration. Add to Prisma schema using preview feature OR run via raw SQL migration.
**Warning signs:** Any `$queryRaw` with `ST_*` functions failing

### Pitfall 3: Prisma Raw SQL Column Name Casing
**What goes wrong:** Raw SQL queries return empty results or wrong columns
**Why it happens:** Prisma uses camelCase in schema but the actual PostgreSQL columns use snake_case (via `@map`). Raw SQL must use snake_case column names.
**How to avoid:** Always use snake_case in `$queryRaw` (e.g., `vendor_id`, `radius_km`, not `vendorId`, `radiusKm`)
**Warning signs:** Queries returning undefined fields

### Pitfall 4: Firebase Private Key Newlines
**What goes wrong:** Firebase Admin SDK throws `"Failed to parse private key"` error
**Why it happens:** Environment variables replace `\n` with literal backslash-n; the key needs actual newline characters
**How to avoid:** Use `.replace(/\\n/g, '\n')` when reading the private key from env, or store the key as a JSON file path
**Warning signs:** Firebase initialization failure on deployment

### Pitfall 5: Scoring Fairness Race Condition
**What goes wrong:** Two concurrent routing jobs both assign the same vendor, exceeding fairness rotation cap
**Why it happens:** Read-then-write on the fairness counter is not atomic
**How to avoid:** Use Redis `INCR` for fairness counters with atomic check-and-increment. Use a Lua script or Redis transaction for the "check cap, then increment" operation.
**Warning signs:** Some vendors getting disproportionately more leads

### Pitfall 6: Missing Consent Check on Lead Creation
**What goes wrong:** Leads are created without DPDP-compliant consent logging
**Why it happens:** Developer forgets to apply ConsentRequiredGuard or log consent
**How to avoid:** Apply `@RequiresConsent(ConsentType.LEAD_CREATION)` decorator on the inquiry endpoint. The guard from Phase 1 (`ConsentRequiredGuard`) already exists.
**Warning signs:** ConsentLog table has no LEAD_CREATION entries for leads

### Pitfall 7: Geography vs Geometry Type Casting
**What goes wrong:** `ST_DWithin` returns wrong results (uses degrees instead of meters)
**Why it happens:** `ST_MakePoint` returns geometry type; distance is in the SRID unit (degrees for 4326). Need to cast to geography for meter-based distances.
**How to avoid:** Always cast to geography: `ST_MakePoint(lng, lat)::geography`. The `::geography` cast makes `ST_DWithin` use meters.
**Warning signs:** Vendors 500km away being matched, or nearby vendors being excluded

## Code Examples

### New Prisma Schema Additions (Phase 3)
```prisma
// Add to schema.prisma

model Lead {
  id              String        @id @default(uuid()) @db.Uuid
  customerId      String        @map("customer_id") @db.Uuid
  eventType       String        @map("event_type") @db.VarChar(50)
  eventDate       DateTime      @map("event_date")
  city            String        @db.VarChar(100)
  budget          Int                                       // in paise
  guestCount      Int           @map("guest_count")
  targetVendorId  String?       @map("target_vendor_id") @db.Uuid  // Mode A: specific vendor
  categoryId      String?       @map("category_id") @db.Uuid       // Mode B: category
  status          String        @default("PENDING") @db.VarChar(20)
  consentLogId    String        @map("consent_log_id") @db.Uuid    // DPDP link
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  customer        User          @relation("CustomerLeads", fields: [customerId], references: [id])
  assignments     LeadAssignment[]

  @@index([customerId])
  @@index([status])
  @@map("leads")
}

model LeadAssignment {
  id           String        @id @default(uuid()) @db.Uuid
  leadId       String        @map("lead_id") @db.Uuid
  vendorId     String        @map("vendor_id") @db.Uuid
  score        Float?                                       // computed score at assignment time
  status       String        @default("PENDING") @db.VarChar(20)
  notifiedAt   DateTime?     @map("notified_at")
  respondedAt  DateTime?     @map("responded_at")
  createdAt    DateTime      @default(now()) @map("created_at")

  lead         Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  vendor       VendorProfile @relation(fields: [vendorId], references: [id])

  @@unique([leadId, vendorId])
  @@index([vendorId])
  @@map("lead_assignments")
}

model DeviceToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  token     String   @unique @db.VarChar(255)
  platform  String   @db.VarChar(20)    // 'android' | 'ios' | 'web'
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("device_tokens")
}
```

### Inquiry Form DTO
```typescript
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateInquiryDto {
  @IsString()
  eventType: string;  // could reference EventCategory slug

  @IsDateString()
  eventDate: string;

  @IsString()
  city: string;

  @IsInt()
  @Min(1)
  budget: number;  // in paise

  @IsInt()
  @Min(1)
  guestCount: number;

  @IsUUID()
  @IsOptional()
  targetVendorId?: string;  // Mode A: specific vendor profile

  @IsUUID()
  @IsOptional()
  categoryId?: string;  // Mode B: category-based inquiry
}
```

### Scoring Formula Implementation
```typescript
// Weights from LEAD-02
const WEIGHTS = {
  SUBSCRIPTION_TIER: 0.30,
  RATING: 0.20,
  RESPONSE_RATE: 0.20,
  LOCATION_MATCH: 0.20,
  FAIRNESS_ROTATION: 0.10,
} as const;

function computeVendorScore(factors: VendorScoreFactors): number {
  // Normalize tier: PREMIUM=1.0, BASIC=0.5
  const tierScore = factors.subscriptionTier === 'PREMIUM' ? 1.0 : 0.5;

  // Normalize rating: 0-5 → 0-1
  const ratingScore = factors.averageRating / 5.0;

  // Response rate already 0-1
  const responseScore = factors.responseRate;

  // Location match: binary 1 or 0
  const locationScore = factors.locationMatch ? 1.0 : 0.0;

  // Fairness: inverse of leads received (fewer leads = higher score)
  // Normalize: if vendor received 0 leads in window → 1.0, max leads → 0.0
  const fairnessScore = Math.max(0, 1.0 - (factors.fairnessCount / factors.maxLeadsInWindow));

  return (tierScore * WEIGHTS.SUBSCRIPTION_TIER)
       + (ratingScore * WEIGHTS.RATING)
       + (responseScore * WEIGHTS.RESPONSE_RATE)
       + (locationScore * WEIGHTS.LOCATION_MATCH)
       + (fairnessScore * WEIGHTS.FAIRNESS_ROTATION);
}
```

### Redis Score Cache Pattern
```typescript
// Cache key: vendor:score:factors:{vendorId}
// Value: JSON string of VendorScoreFactors
// TTL: 300 seconds

async cacheVendorScoreFactors(vendorId: string, factors: VendorScoreFactors): Promise<void> {
  await this.redis.set(
    `vendor:score:factors:${vendorId}`,
    JSON.stringify(factors),
    300,
  );
}

async getVendorScoreFactors(vendorId: string): Promise<VendorScoreFactors | null> {
  const cached = await this.redis.get(`vendor:score:factors:${vendorId}`);
  return cached ? JSON.parse(cached) : null;
}

// Invalidation triggers:
// 1. Subscription change → invalidate vendor:score:factors:{vendorId}
// 2. New rating received → invalidate
// 3. Response to lead → invalidate (response rate changes)
```

### Enqueueing a Lead Routing Job
```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class LeadService {
  constructor(
    @InjectQueue('lead-routing') private routingQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async createInquiry(customerId: string, dto: CreateInquiryDto) {
    // 1. Create lead record
    const lead = await this.prisma.lead.create({
      data: {
        customerId,
        eventType: dto.eventType,
        eventDate: new Date(dto.eventDate),
        city: dto.city,
        budget: dto.budget,
        guestCount: dto.guestCount,
        targetVendorId: dto.targetVendorId ?? null,
        categoryId: dto.categoryId ?? null,
        consentLogId: '...', // from consent check
        status: 'PENDING',
      },
    });

    // 2. Enqueue async routing job
    const mode = dto.targetVendorId ? 'A' : 'B';
    await this.routingQueue.add('route-lead', {
      leadId: lead.id,
      mode,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    // 3. Return immediate acknowledgment
    return {
      leadId: lead.id,
      status: 'PENDING',
      message: 'Your inquiry has been received. We are matching you with the best vendors.',
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@nestjs/bull` (Bull v3) | `@nestjs/bullmq` (BullMQ v5) | 2023 | BullMQ is the successor; Bull v3 is in maintenance mode |
| FCM Legacy HTTP API | FCM HTTP v1 API | June 2024 (legacy deprecated) | Must use `firebase-admin` >= 11.7.0 for new send APIs |
| `admin.messaging().sendToDevice()` | `admin.messaging().send()` | firebase-admin 11.7.0+ | `sendToDevice` is deprecated; use `send()` with token field |
| Prisma `$queryRaw` template literal | Same (no change) | Ongoing | Still the only way to use PostGIS with Prisma; no native support |

**Deprecated/outdated:**
- `@nestjs/bull`: Use `@nestjs/bullmq` instead. Bull v3 is maintenance-only.
- `admin.messaging().sendToDevice()`: Removed in firebase-admin v12+. Use `send()`.
- `admin.messaging().sendAll()`: Deprecated. Use `sendEach()` or `sendEachForMulticast()`.

## Design Decisions

### 03-01 Should Be API Endpoints, Not Frontend
**Evidence:** The `apps/web` directory contains only a stub `package.json` with no dependencies or source code. The entire project is API-only (`api/src/` with NestJS). Building a Next.js frontend now would be premature and out of scope for this phase. Plan 03-01 should create REST endpoints under a `/customer` or `/public` route prefix that a future web/mobile client will consume.

### PostGIS Strategy: Raw SQL via $queryRaw
**Evidence:** Prisma issue #2789 (PostGIS support request) remains open since 2020. No `prisma-extension-postgis` npm package exists as a stable solution. The community consensus (multiple blog posts, Prisma discussions) is to use `$queryRaw` with PostGIS functions. The project already uses `postgis/postgis:16-3.4-alpine` Docker image, so PostGIS functions are available -- just need `CREATE EXTENSION IF NOT EXISTS postgis;`.

### Separate DeviceToken Table for FCM
**Evidence:** FCM tokens are device-specific (a user may have multiple devices), change on app reinstall, and expire. Storing them on VendorProfile would limit to one token per vendor. A separate `device_tokens` table supports multi-device push and clean token management.

### Vendor Score Factors: What Exists vs What Needs Adding
**Existing data:** Subscription tier (via VendorSubscription + SubscriptionPlan), service areas (VendorServiceArea + Market with lat/lng)
**Missing data (needs new fields/tables):** Average rating (no reviews/ratings table yet), response rate (no lead response tracking yet), fairness rotation counter (Redis-based, no persistence needed)
**Recommendation:** Add a `VendorStats` model or computed fields. For MVP, seed default values: rating=3.0, responseRate=0.5. Build the ratings system in a later phase but design the scoring service to accept these factors regardless of source.

## Open Questions

1. **Vendor Ratings/Reviews Table**
   - What we know: LEAD-02 requires "Rating (20%)" as a scoring factor. CUST-03 mentions "ratings" in vendor profiles.
   - What's unclear: No ratings/reviews schema exists yet. Should Phase 3 add a ratings table, or use placeholder values?
   - Recommendation: Add a simple `vendor_stats` cache (average_rating, response_rate, total_leads) to the schema. Populate with defaults. Build the full review system later. The scoring service should read from this stats table.

2. **Customer Event Location Resolution**
   - What we know: Customer submits a "city" string in the inquiry form. Markets table has city+lat/lng.
   - What's unclear: What if the customer's city doesn't match any market exactly?
   - Recommendation: Match against the `markets` table by city name (case-insensitive). If no exact match, return an error. PostGIS distance calculation uses the matched market's lat/lng as the event location.

3. **FCM Token Registration Endpoint**
   - What we know: Vendors need FCM tokens stored to receive push notifications.
   - What's unclear: When does the vendor register their FCM token? (Login? App startup?)
   - Recommendation: Add a `POST /notifications/register-device` endpoint that accepts { token, platform }. Call it on app startup / login. This is part of Plan 03-03.

4. **Fairness Rotation Window**
   - What we know: LEAD-02 gives fairness rotation 10% weight.
   - What's unclear: What time window defines "rotation"? Daily? Weekly? Per-category?
   - Recommendation: Use a 7-day sliding window per category. Track via Redis key `fairness:{categoryId}:{vendorId}` with TTL of 7 days, incrementing on each lead assignment.

## Sources

### Primary (HIGH confidence)
- BullMQ NestJS docs: https://docs.bullmq.io/guide/nestjs - Setup, processor pattern, queue registration
- BullMQ connections: https://docs.bullmq.io/guide/connections - maxRetriesPerRequest caveat, connection reuse rules
- NestJS Queues docs: https://docs.nestjs.com/techniques/queues - @nestjs/bullmq integration patterns
- PostGIS ST_DWithin docs: https://postgis.net/docs/ST_DWithin.html - Geography vs geometry, meter-based distance
- Firebase Admin setup: https://firebase.google.com/docs/admin/setup - SDK initialization, credential patterns

### Secondary (MEDIUM confidence)
- Prisma + PostGIS patterns: https://alizahid.dev/blog/geo-queries-with-prisma - $queryRaw with ST_DWithin verified approach
- Prisma PostGIS guide: https://freddydumont.com/blog/prisma-postgis - Unsupported type pattern
- Firebase Admin releases: https://firebase.google.com/support/release-notes/admin/node - v13.7.0 latest, FCM v1 confirmed
- Prisma PostGIS issue: https://github.com/prisma/prisma/issues/2789 - Confirms no native support, raw SQL required

### Tertiary (LOW confidence)
- Fairness rotation algorithm: Based on general round-robin/weighted rotation patterns -- no specific Zevento-domain source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and npm
- Architecture: HIGH - Follows established NestJS module patterns used in Phase 1-2
- PostGIS integration: HIGH - Multiple sources confirm $queryRaw approach; Docker image already has PostGIS
- BullMQ integration: HIGH - Official @nestjs/bullmq with documented patterns
- Firebase FCM: HIGH - Official firebase-admin SDK, v1 API confirmed
- Scoring algorithm: MEDIUM - Weights defined in requirements, but rating/response-rate data sources need design decisions
- Fairness rotation: MEDIUM - Algorithm design is sound but rotation window parameters are assumed

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (30 days - stack is stable)
