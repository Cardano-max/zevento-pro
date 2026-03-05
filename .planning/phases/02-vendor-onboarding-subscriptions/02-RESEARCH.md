# Phase 2: Vendor Onboarding and Subscriptions - Research

**Researched:** 2026-03-06
**Domain:** Vendor profiles, Razorpay Subscriptions, Cloudinary image upload, PostGIS-ready service areas, KYC admin workflow
**Confidence:** HIGH

## Summary

Phase 2 adds vendor business profiles with progressive onboarding, portfolio photo uploads via Cloudinary, PostGIS-ready service area storage, Razorpay subscription billing with webhook-driven lifecycle, KYC document upload and admin review queue, and event category management. The existing NestJS API (Prisma, Redis, JWT auth, admin role guard) provides a solid foundation. The main integration surface areas are Razorpay Subscriptions API (plans + subscriptions + webhooks), Cloudinary Node.js SDK (upload_stream with multer buffers), and PostGIS-compatible geography columns in Prisma (using `Unsupported` type + raw SQL).

The docker-compose currently uses `postgres:16-alpine` which does NOT include PostGIS -- must switch to `postgis/postgis:16-3.4-alpine` for Phase 3 readiness. For Phase 2, storing lat/lng as `Float` columns is sufficient, but the schema should be designed so Phase 3 can add a geography column and index without breaking changes.

**Primary recommendation:** Use Razorpay official Node SDK (`razorpay` npm) for subscription billing, `cloudinary` npm v2 for image uploads with multer memory storage, store service area as `lat`/`lng` floats + `radiusKm` integer (PostGIS migration deferred to Phase 3), and implement KYC as a state machine (DRAFT -> SUBMITTED -> APPROVED/REJECTED).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Progressive step-by-step onboarding (not single form)
- Step 1: Phone + Name + Role (Planner/Supplier) -- uses existing OTP auth from Phase 1
- Step 2: Business name, categories, pricing ranges
- Step 3: Portfolio photos (tagged by event type)
- Step 4: Service cities + coverage radius
- Step 5: Submit for KYC review
- Vendor can save progress and return to complete later
- Flexible KYC per role: Planners need Aadhaar or PAN (many are freelancers without GST). Suppliers need GST certificate required (B2B tax invoicing needs it)
- Both roles upload identity document + business proof where applicable
- Razorpay Subscriptions API for recurring billing with auto-renewal
- Cloudinary for portfolio image hosting
- Service area must be PostGIS-ready for Phase 3 distance matching
- SRS: Planner subscription Rs.12,000/month, Supplier Rs.36,000/month
- First category focus: Birthday Decoration + Balloon Decor
- Razorpay Payout KYC application must be submitted during Phase 2 (ops action, not code)

### Claude's Discretion
- **Planner vs Supplier onboarding divergence** -- Same flow with role-specific fields vs separate flows
- **Minimum portfolio requirements** -- minimum 1-3 photos or optional at submission
- **Service area definition** -- City dropdown + radius, map pin + radius, or city-only
- **Vendor pending state** -- what vendors can do while KYC is pending
- **KYC rejection handling** -- reject with reason + re-submit vs permanent rejection
- **Auto-approval path** -- always manual vs auto-approve if docs valid vs manual-for-now
- **Subscription plan trial period** -- free trial, grace period on lapse, expiry behavior
- **Admin panel workflow** -- KYC approval queue design, category management depth, vendor lifecycle actions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Discretion Recommendations

Based on research findings, here are recommendations for Claude's Discretion items:

### Planner vs Supplier onboarding divergence
**Recommendation: Same flow with role-specific conditional fields.**
Rationale: The schema differences are minimal (GST required for Supplier, optional for Planner). A single `VendorProfile` model with a `role` discriminator and conditional validation at the DTO level avoids code duplication. The progressive onboarding steps are identical in structure; only field requirements differ.

### Minimum portfolio requirements
**Recommendation: Optional at submission (0 minimum), but show a "marketplace quality" nudge if < 3 photos.**
Rationale: Early-stage marketplace needs supply-side liquidity. Blocking onboarding for portfolio photos loses vendors who want to "sign up and upload later." A soft nudge ("vendors with 3+ photos get 2x more leads") balances quality without friction.

### Service area definition
**Recommendation: Market (city) selection from Markets table + radius in km.**
Rationale: The `markets` table already exists as a first-class entity from Phase 1. Vendors select one or more markets and set a `radiusKm` per market. Store lat/lng on the Market model (city center coordinates, admin-defined). In Phase 3, add a PostGIS geography column computed from market lat/lng. This avoids requiring vendors to pin a map location (friction) while keeping PostGIS compatibility.

### Vendor pending state
**Recommendation: Profile visible to admins only, no leads, can edit profile.**
Rationale: Quality control is critical for marketplace trust. Vendors can complete and polish their profile while waiting, but are not visible to customers or eligible for leads until approved. This prevents bad actors from receiving leads before verification.

### KYC rejection handling
**Recommendation: Reject with reason + allow re-submission (unlimited attempts).**
Rationale: Common reasons (blurry document, wrong document type) are easily fixable. Permanent rejection would require a new account, which is hostile UX. Rejected vendors get a clear reason and can re-upload documents.

### Auto-approval path
**Recommendation: Manual-only for now.**
Rationale: Early stage with low vendor volume. Manual review catches quality issues and builds institutional knowledge about what "good" looks like. Auto-approval can be added later when patterns are clear. The state machine supports it -- just add a transition rule.

### Subscription plan trial period
**Recommendation: No free trial initially. 3-day grace period after payment failure before downgrading to inactive. Expired subscription = profile hidden, no leads.**
Rationale: SRS specifies fixed pricing (Rs.12K/Rs.36K monthly). Free trials devalue the product at launch. Grace period prevents accidental churn from payment failures. Razorpay handles retry logic (3 attempts over configurable period) before marking halted.

### Admin panel workflow
**Recommendation: Phase 2 admin panel is API-only (REST endpoints). UI is deferred to Phase 4 (admin app scaffold). KYC queue = paginated list sorted by submission date with status filter. Category management = full CRUD. Vendor lifecycle = suspend/reactivate toggles.**
Rationale: The admin Next.js app is explicitly scaffolded in Phase 4. Phase 2 builds the API endpoints that Phase 4 will consume. This keeps Phase 2 focused on backend logic.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| razorpay | ^2.9.x | Subscription plans, billing, webhooks | Official Razorpay Node SDK; typed API methods for plans.create, subscriptions.create, webhooks |
| cloudinary | ^2.x | Portfolio image upload, transformation, CDN | Official Cloudinary Node SDK; upload_stream for buffer-based uploads |
| multer | (built into @nestjs/platform-express) | File upload middleware | NestJS built-in FileInterceptor uses multer; memoryStorage for buffer access |
| streamifier | ^0.1.x | Convert multer buffer to readable stream | Required for cloudinary.uploader.upload_stream pipe pattern |
| @types/multer | ^1.x | TypeScript types for Express.Multer.File | Type safety for file upload handlers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node built-in) | N/A | Razorpay webhook signature verification | HMAC SHA256 verification on every webhook |
| class-validator | (already installed) | DTO validation | Validate onboarding step fields, conditional by role |
| class-transformer | (already installed) | DTO transformation | Transform incoming DTOs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cloudinary npm | nestjs-cloudinary (@scwar) | Community wrapper; adds abstraction but less control, smaller maintainer base |
| multer memoryStorage | multer diskStorage | Disk requires cleanup; memory is fine for images < 10MB |
| Manual webhook verification | razorpay SDK utility | SDK has Razorpay.validateWebhookSignature() -- use this instead of manual HMAC |

**Installation:**
```bash
cd api && pnpm add razorpay cloudinary streamifier && pnpm add -D @types/multer @types/streamifier
```

## Architecture Patterns

### Recommended Module Structure
```
api/src/
  vendor/
    vendor.module.ts
    vendor.controller.ts        # Profile CRUD, onboarding steps
    vendor.service.ts           # Business logic, onboarding state
    dto/
      create-profile.dto.ts     # Step 2: business details
      update-portfolio.dto.ts   # Step 3: photo metadata
      update-service-area.dto.ts # Step 4: markets + radius
      submit-kyc.dto.ts         # Step 5: document upload
    guards/
      vendor-owner.guard.ts     # Ensure vendor can only edit own profile
  subscription/
    subscription.module.ts
    subscription.controller.ts  # Plan selection, checkout initiation
    subscription.service.ts     # Razorpay plan/subscription CRUD
    razorpay.service.ts         # Razorpay SDK wrapper (singleton)
    webhook/
      subscription-webhook.controller.ts  # POST /webhooks/razorpay/subscription
      subscription-webhook.service.ts     # Process webhook events
  cloudinary/
    cloudinary.module.ts
    cloudinary.service.ts       # Upload, delete, transform
    cloudinary.provider.ts      # ConfigService-based provider
  admin/                        # Extend existing admin module
    admin.controller.ts         # Add KYC, category, subscription plan endpoints
    admin.service.ts            # Add KYC review, category CRUD
    dto/
      review-kyc.dto.ts
      manage-category.dto.ts
      manage-plan.dto.ts
```

### Pattern 1: Progressive Onboarding State Machine
**What:** Vendor profile has an `onboardingStep` field (1-5) tracking progress. Each step endpoint validates and saves data, advancing the step counter. Vendor can resume from last completed step.
**When to use:** Any multi-step form where partial state must persist.
```typescript
// Onboarding step enum in shared package
export enum OnboardingStep {
  REGISTERED = 1,      // After OTP + name + role (Phase 1 auth)
  BUSINESS_DETAILS = 2,
  PORTFOLIO = 3,
  SERVICE_AREA = 4,
  KYC_SUBMITTED = 5,
}

// Vendor profile status
export enum VendorStatus {
  DRAFT = 'DRAFT',           // Onboarding incomplete
  PENDING_KYC = 'PENDING_KYC', // KYC submitted, awaiting review
  APPROVED = 'APPROVED',     // KYC approved, active vendor
  REJECTED = 'REJECTED',     // KYC rejected, can re-submit
  SUSPENDED = 'SUSPENDED',   // Admin suspended
}
```

### Pattern 2: Razorpay Webhook Idempotency
**What:** Reuse the existing `webhook_events` table with provider='RAZORPAY' for subscription events. Check unique constraint (provider, externalId, eventType) before processing.
**When to use:** Every Razorpay webhook handler.
```typescript
// In subscription-webhook.service.ts
async handleWebhook(payload: any, signature: string) {
  // 1. Verify signature using Razorpay.validateWebhookSignature()
  // 2. Check webhook_events for duplicate (provider, externalId, eventType)
  // 3. Insert with status=RECEIVED
  // 4. Process event (update subscription status, etc.)
  // 5. Update webhook_event status to PROCESSED
}
```

### Pattern 3: Cloudinary Upload with Multer
**What:** Use NestJS FileInterceptor (multer memoryStorage) to receive file buffer, pipe to Cloudinary upload_stream.
**When to use:** Portfolio photo uploads, KYC document uploads.
```typescript
// In cloudinary.service.ts
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

async uploadImage(file: Express.Multer.File, folder: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
}
```

### Pattern 4: Razorpay Service Wrapper
**What:** Singleton NestJS service wrapping Razorpay SDK instance. Initialized via ConfigService with key_id and key_secret.
**When to use:** All Razorpay API interactions.
```typescript
// In razorpay.service.ts
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayService {
  private instance: Razorpay;

  constructor(private config: ConfigService) {
    this.instance = new Razorpay({
      key_id: config.get('RAZORPAY_KEY_ID'),
      key_secret: config.get('RAZORPAY_KEY_SECRET'),
    });
  }

  async createPlan(params: { period: string; interval: number; item: { name: string; amount: number; currency: string; description: string } }) {
    return this.instance.plans.create(params);
  }

  async createSubscription(params: { plan_id: string; total_count: number; customer_notify?: boolean }) {
    return this.instance.subscriptions.create(params);
  }

  validateWebhookSignature(body: string, signature: string, secret: string): boolean {
    return Razorpay.validateWebhookSignature(body, signature, secret);
  }
}
```

### Anti-Patterns to Avoid
- **Storing images in database:** Use Cloudinary URLs, not binary blobs. Store `cloudinaryPublicId` and `cloudinaryUrl` in the database.
- **Polling Razorpay for subscription status:** Use webhooks. The `subscription.charged`, `subscription.halted`, `subscription.cancelled` events are authoritative.
- **Parsing webhook JSON before signature verification:** Verify against raw body string first. Express body-parser can alter float precision, causing signature mismatch.
- **Single vendor_profiles table for everything:** Split into `vendor_profiles` (core business info), `portfolio_photos` (separate table, many-to-one), `service_areas` (vendor-to-market join table with radius), `kyc_documents` (separate table with status).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription billing/retry | Custom billing scheduler | Razorpay Subscriptions API | Handles payment retries (3 attempts), dunning, auto-renewal, proration |
| Image CDN/transformation | File storage + resize pipeline | Cloudinary | CDN delivery, on-the-fly transforms (thumbnails), bandwidth optimization |
| Webhook signature verification | Custom HMAC implementation | `Razorpay.validateWebhookSignature()` | SDK method handles edge cases (encoding, float precision) |
| File upload parsing | Custom multipart parser | NestJS FileInterceptor (multer) | Battle-tested, handles edge cases, memory/disk storage options |
| Geography distance queries | Haversine formula in JS | PostGIS ST_DWithin (Phase 3) | Database-level spatial index, handles edge cases (poles, date line) |

**Key insight:** Razorpay and Cloudinary both provide SDKs that handle the hard parts (retry logic, CDN routing, signature verification). Hand-rolling these adds bugs without adding value.

## Common Pitfalls

### Pitfall 1: Razorpay Webhook Signature Mismatch
**What goes wrong:** Webhook verification fails even though secret is correct.
**Why it happens:** Express/NestJS JSON body parser converts the raw body to a parsed object. When you JSON.stringify it back, float precision or key ordering can differ from the original payload.
**How to avoid:** Use NestJS raw body access. Configure the webhook endpoint to receive the raw body string for signature verification. In NestJS, use `@Req() req` with `rawBody` option enabled in main.ts: `app.useBodyParser('json', { rawBody: true })` or use a dedicated raw body middleware.
**Warning signs:** Signature verification passes in tests but fails in production.

### Pitfall 2: Razorpay Amount in Paise
**What goes wrong:** Charging Rs.12,000 but only charging Rs.120 (or 12,000 paise = Rs.120).
**Why it happens:** Razorpay amounts are in smallest currency unit (paise for INR). Rs.12,000 = 1,200,000 paise.
**How to avoid:** Always store amounts in paise in the database. Convert to rupees only at display time. Plan amount for Rs.12,000/month = `1200000`.
**Warning signs:** Test subscription charges look 100x too small.

### Pitfall 3: Cloudinary Upload Without Folder Structure
**What goes wrong:** All images dumped in root folder, impossible to manage or clean up.
**Why it happens:** Not specifying `folder` parameter in upload options.
**How to avoid:** Use structured folders: `vendors/{vendorId}/portfolio/`, `vendors/{vendorId}/kyc/`. Set `folder` in upload options.
**Warning signs:** Cloudinary dashboard shows flat list of thousands of images.

### Pitfall 4: Missing Webhook Event Types
**What goes wrong:** Subscription status in local DB gets out of sync with Razorpay.
**Why it happens:** Only handling `subscription.charged` but not `subscription.halted`, `subscription.cancelled`, `subscription.pending`.
**How to avoid:** Handle ALL subscription webhook events: `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.paused`, `subscription.resumed`, `subscription.cancelled`, `subscription.completed`.
**Warning signs:** Vendors with failed payments still showing as active.

### Pitfall 5: Docker PostgreSQL Without PostGIS
**What goes wrong:** `CREATE EXTENSION postgis` fails because extension is not available.
**Why it happens:** Current docker-compose uses `postgres:16-alpine` which does not include PostGIS.
**How to avoid:** Switch to `postgis/postgis:16-3.4-alpine` image in docker-compose. This is backward-compatible -- regular Postgres queries still work, but PostGIS functions become available.
**Warning signs:** Migration fails with "could not open extension control file" error.

### Pitfall 6: Prisma db push vs Prisma migrate
**What goes wrong:** `Unsupported` column types (PostGIS geometry) don't work with `prisma db push`.
**Why it happens:** `db push` tries to recreate tables and cannot handle Unsupported types properly.
**How to avoid:** Use `prisma migrate dev` for any schema with Unsupported types. For Phase 2, stick to Float columns for lat/lng (no Unsupported type needed yet). Phase 3 will add the geography column via manual migration SQL.
**Warning signs:** Schema push errors mentioning "unsupported" types.

## Code Examples

### Prisma Schema Additions (Phase 2)
```prisma
// Add to existing schema.prisma

model VendorProfile {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @unique @map("user_id") @db.Uuid
  role            String   @db.VarChar(20) // PLANNER or SUPPLIER
  businessName    String   @map("business_name") @db.VarChar(200)
  description     String?  @db.Text
  pricingMin      Int?     @map("pricing_min") // In paise
  pricingMax      Int?     @map("pricing_max") // In paise
  onboardingStep  Int      @default(1) @map("onboarding_step")
  status          String   @default("DRAFT") @db.VarChar(20)
  rejectionReason String?  @map("rejection_reason") @db.Text
  submittedAt     DateTime? @map("submitted_at")
  approvedAt      DateTime? @map("approved_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  categories      VendorCategory[]
  photos          PortfolioPhoto[]
  serviceAreas    VendorServiceArea[]
  kycDocuments    KycDocument[]
  subscription    VendorSubscription?

  @@map("vendor_profiles")
}

model EventCategory {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(100)
  slug        String   @unique @db.VarChar(100)
  description String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  vendors     VendorCategory[]
  photos      PortfolioPhoto[]

  @@map("event_categories")
}

model VendorCategory {
  id         String @id @default(uuid()) @db.Uuid
  vendorId   String @map("vendor_id") @db.Uuid
  categoryId String @map("category_id") @db.Uuid

  vendor     VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  category   EventCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([vendorId, categoryId])
  @@map("vendor_categories")
}

model PortfolioPhoto {
  id                String   @id @default(uuid()) @db.Uuid
  vendorId          String   @map("vendor_id") @db.Uuid
  categoryId        String?  @map("category_id") @db.Uuid
  cloudinaryPublicId String  @map("cloudinary_public_id") @db.VarChar(255)
  cloudinaryUrl     String   @map("cloudinary_url") @db.Text
  caption           String?  @db.VarChar(255)
  sortOrder         Int      @default(0) @map("sort_order")
  createdAt         DateTime @default(now()) @map("created_at")

  vendor            VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  category          EventCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([vendorId])
  @@map("portfolio_photos")
}

model VendorServiceArea {
  id        String @id @default(uuid()) @db.Uuid
  vendorId  String @map("vendor_id") @db.Uuid
  marketId  String @map("market_id") @db.Uuid
  radiusKm  Int    @default(25) @map("radius_km")

  vendor    VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  market    Market        @relation(fields: [marketId], references: [id], onDelete: Cascade)

  @@unique([vendorId, marketId])
  @@map("vendor_service_areas")
}

model KycDocument {
  id                 String   @id @default(uuid()) @db.Uuid
  vendorId           String   @map("vendor_id") @db.Uuid
  documentType       String   @map("document_type") @db.VarChar(30) // AADHAAR, PAN, GST_CERTIFICATE
  cloudinaryPublicId String   @map("cloudinary_public_id") @db.VarChar(255)
  cloudinaryUrl      String   @map("cloudinary_url") @db.Text
  createdAt          DateTime @default(now()) @map("created_at")

  vendor             VendorProfile @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@index([vendorId])
  @@map("kyc_documents")
}

model SubscriptionPlan {
  id                String   @id @default(uuid()) @db.Uuid
  name              String   @db.VarChar(100) // "Planner Basic", "Supplier Premium"
  vendorRole        String   @map("vendor_role") @db.VarChar(20) // PLANNER or SUPPLIER
  tier              String   @db.VarChar(20) // BASIC or PREMIUM
  amountPaise       Int      @map("amount_paise") // Amount in paise
  periodMonths      Int      @default(1) @map("period_months")
  razorpayPlanId    String?  @unique @map("razorpay_plan_id") @db.VarChar(50)
  features          Json?    // Feature list for display
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  subscriptions     VendorSubscription[]

  @@unique([vendorRole, tier])
  @@map("subscription_plans")
}

model VendorSubscription {
  id                    String    @id @default(uuid()) @db.Uuid
  vendorId              String    @unique @map("vendor_id") @db.Uuid
  planId                String    @map("plan_id") @db.Uuid
  razorpaySubscriptionId String?  @unique @map("razorpay_subscription_id") @db.VarChar(50)
  status                String    @default("CREATED") @db.VarChar(20)
  currentPeriodStart    DateTime? @map("current_period_start")
  currentPeriodEnd      DateTime? @map("current_period_end")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  vendor                VendorProfile    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  plan                  SubscriptionPlan @relation(fields: [planId], references: [id])
  transactions          Transaction[]

  @@map("vendor_subscriptions")
}

model Transaction {
  id                    String   @id @default(uuid()) @db.Uuid
  vendorSubscriptionId  String   @map("vendor_subscription_id") @db.Uuid
  type                  String   @default("SUBSCRIPTION") @db.VarChar(20)
  amountPaise           Int      @map("amount_paise")
  razorpayPaymentId     String?  @unique @map("razorpay_payment_id") @db.VarChar(50)
  status                String   @db.VarChar(20) // PAID, FAILED, REFUNDED
  paidAt                DateTime? @map("paid_at")
  createdAt             DateTime @default(now()) @map("created_at")

  subscription          VendorSubscription @relation(fields: [vendorSubscriptionId], references: [id])

  @@index([vendorSubscriptionId])
  @@map("transactions")
}
```

### Market Table Update (add lat/lng for Phase 3 readiness)
```prisma
// Update existing Market model
model Market {
  id         String    @id @default(uuid()) @db.Uuid
  city       String    @db.VarChar(100)
  state      String    @db.VarChar(100)
  latitude   Float?    // City center lat, admin-defined
  longitude  Float?    // City center lng, admin-defined
  status     String    @default("PLANNED") @db.VarChar(20)
  launchDate DateTime? @map("launch_date")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  serviceAreas VendorServiceArea[]

  @@unique([city, state])
  @@map("markets")
}
```

### Razorpay Subscription Webhook Events to Handle
```typescript
// Source: https://razorpay.com/docs/webhooks/subscriptions/
export enum RazorpaySubscriptionEvent {
  AUTHENTICATED = 'subscription.authenticated',
  ACTIVATED = 'subscription.activated',
  CHARGED = 'subscription.charged',
  PENDING = 'subscription.pending',
  HALTED = 'subscription.halted',
  CANCELLED = 'subscription.cancelled',
  PAUSED = 'subscription.paused',
  RESUMED = 'subscription.resumed',
  COMPLETED = 'subscription.completed',
}
```

### NestJS Raw Body for Webhook Verification
```typescript
// In main.ts -- enable raw body access
const app = await NestFactory.create(AppModule, {
  rawBody: true,  // Makes req.rawBody available
});

// In webhook controller
@Post('webhooks/razorpay')
async handleWebhook(
  @Req() req: RawBodyRequest<Request>,
  @Headers('x-razorpay-signature') signature: string,
) {
  const rawBody = req.rawBody.toString();
  // Verify signature against rawBody, not parsed body
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Razorpay Orders for recurring | Razorpay Subscriptions API | Stable since 2020 | Native retry, dunning, lifecycle management |
| Cloudinary v1 SDK | Cloudinary v2 SDK (`import { v2 as cloudinary }`) | v2 is current | New API surface, promise support |
| Prisma native PostGIS | Prisma `Unsupported` + raw SQL | Ongoing (issue #2789) | No native Prisma PostGIS support; use Unsupported + $queryRaw |
| prisma db push | prisma migrate dev | Best practice | Required for Unsupported types and custom SQL |

**Deprecated/outdated:**
- Razorpay `razorpay-typescript` (unofficial) -- use official `razorpay` npm which includes types
- Cloudinary `cloudinary.uploader.upload(filePath)` for server uploads -- prefer `upload_stream` with buffers (no temp files)

## Open Questions

1. **Razorpay Plan IDs: Admin-created or seeded?**
   - What we know: Plans must exist in Razorpay before subscriptions can reference them. Admin should manage plan definitions (ADMIN-06).
   - What's unclear: Should plan creation in admin panel also create the plan in Razorpay via API, or should plans be pre-seeded and Razorpay IDs stored manually?
   - Recommendation: Admin creates plan in local DB, and the service auto-creates in Razorpay if `razorpayPlanId` is null. Lazy sync pattern avoids needing Razorpay API keys in dev.

2. **NOTF-04: Admin alert mechanism for KYC submissions**
   - What we know: Requirement says admin receives alerts for KYC submissions.
   - What's unclear: Email? In-app notification? SMS?
   - Recommendation: For Phase 2 (API-only admin), create an `admin_notifications` table with unread count. Phase 4 admin UI will poll or use SSE. Email notification can be added later via MSG91 transactional email or similar.

3. **Subscription plan tiers: 2 or 4?**
   - What we know: SRS mentions Planner (Rs.12K) and Supplier (Rs.36K). Success criteria mention "Basic or Premium."
   - What's unclear: Are there 4 plans (Planner Basic, Planner Premium, Supplier Basic, Supplier Premium) or 2 (one per role)?
   - Recommendation: Build for 4 plans (2 per role: Basic + Premium) as the success criteria explicitly mentions tier selection. Seed initial plans with SRS pricing as "Basic" tier. Premium pricing TBD by admin.

## Sources

### Primary (HIGH confidence)
- [Razorpay Subscriptions API docs](https://razorpay.com/docs/api/payments/subscriptions/) -- plan/subscription lifecycle, webhook events
- [Razorpay Node SDK GitHub](https://github.com/razorpay/razorpay-node) -- SDK method signatures for plans and subscriptions
- [Razorpay Webhook Events](https://razorpay.com/docs/webhooks/subscriptions/) -- complete subscription event list
- [Cloudinary Node.js SDK docs](https://cloudinary.com/documentation/node_integration) -- upload_stream API, configuration
- [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference) -- signed uploads, folder structure
- Existing codebase: Prisma schema, admin module, auth guards, webhook_events table

### Secondary (MEDIUM confidence)
- [Prisma PostGIS guide](https://freddydumont.com/blog/prisma-postgis) -- Unsupported type, raw SQL pattern, GIST index
- [Prisma PostGIS issue #2789](https://github.com/prisma/prisma/issues/2789) -- confirms no native support, Unsupported workaround
- [Cloudinary + NestJS blog](https://cloudinary.com/blog/guest_post/signed-image-uploading-to-cloudinary-with-angular-and-nestjs) -- streamifier pattern

### Tertiary (LOW confidence)
- Razorpay `Razorpay.validateWebhookSignature()` method -- referenced in SDK issues but not verified in current SDK version docs. Fallback: manual crypto.createHmac verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- official SDKs with well-documented APIs
- Architecture: HIGH -- patterns derived from existing codebase conventions and official docs
- Razorpay integration: HIGH -- official API docs + SDK methods verified
- Cloudinary integration: HIGH -- official docs + established NestJS patterns
- PostGIS readiness: MEDIUM -- Prisma limitation confirmed, workaround pattern verified, but Phase 2 defers actual PostGIS to Phase 3
- Pitfalls: HIGH -- drawn from official docs, GitHub issues, and known integration gotchas

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (30 days -- stable domain, established libraries)
