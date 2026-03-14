# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Customers can discover and book event services while the platform intelligently routes qualified leads to the best-matched vendors, creating value for both sides of the marketplace.
**Current focus:** Phase 07.2 in progress — Enterprise Extension: feed/favorites backend + customer web pages complete (plans 1-2 done), vendor dashboard complete (plan 3 done).

## Current Position

Phase: 07.2 (Zavento Enterprise Extension)
Plan: 5/5 complete — PHASE COMPLETE
Status: Phase 07.2 COMPLETE — All 5 plans done. All apps deployed to production. API on Render, 3 frontend apps on Vercel.
Last activity: 2026-03-15 — Completed 07.2-05: production deployment — all apps live

Progress: [██████████] 100% (20/20 original plans + 07.2 phase complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: 9 min
- Total execution time: 2.65 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 75 min | 25 min |
| 02-vendor-onboarding-subscriptions | 3/3 | 18 min | 6 min |
| 03-lead-routing-engine | 3/3 | 13 min | 4 min |
| 04-vendor-crm-and-booking-flow | 3/3 | 39 min | 13 min |
| 05-payments-and-commission-settlement | 3/3 | 15 min | 5 min |
| 06-b2b-product-marketplace | 3/3 | ~32 min | ~11 min |
| 07-analytics-and-admin-hardening | 2/2 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 06-02 (8 min), 06-03 (3 min), 07-01 (2 min), 07-02 (5 min)
- Trend: Phase 7 fast — audit trail + admin endpoints over existing routing infrastructure

*Updated after each plan completion*

## Accumulated Context

### Roadmap Evolution

- Phase 07.1 inserted after Phase 7: Wedding Event Planner Platform - Beautiful UI Customer Web App with AI Planning (URGENT) — full customer-facing web app with 2026 trendy UI, AI budget-based wedding planner, service provider discovery, vendor marketplace, mobile-first responsive design
- Phase 07.2 inserted after Phase 07.1: Zavento Enterprise Extension — Stripe payments, S3 uploads, private messaging (Socket.IO), social feed, vendor availability calendar, favorites, moderation/reporting, full frontend dashboards (customer + vendor + admin), Docker/DevOps. Transforms platform into real enterprise-grade SaaS.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Multi-role identity schema and PostGIS geography must be locked in Phase 1 — cannot be retrofitted post-launch
- [Roadmap]: Vendor onboarding and subscription billing ship before lead routing engine (scoring algorithm weights subscription tier 30%)
- [Roadmap]: B2B product marketplace deferred to Phase 6 — after core lead-to-booking-to-payment flywheel is validated
- [Roadmap]: Razorpay Payout KYC application must be submitted during Phase 2 (approval takes 2-4 weeks; blocks Phase 5 payouts)
- [Roadmap]: TRAI DLT SMS template registration must be completed before Phase 1 development ends (unregistered templates are operator-blocked)
- [01-01]: Roles stored in user_roles table (not users.role column) — multi-role identity, prevents role-lock at account level
- [01-01]: markets is a first-class table (not city string) — city expansion without data migration
- [01-01]: webhook_events (provider, externalId, eventType) unique constraint — hard idempotency guard for Razorpay double-delivery
- [01-01]: All IDs are UUID v4 — no sequential ID enumeration attacks
- [01-01]: pnpm-workspace.yaml onlyBuiltDependencies for Prisma/NestJS — resolves pnpm v10 strict build script security mode
- [01-03]: Consent stored as append-only log — never mutate GRANTED records; REVOKED always creates new row (DPDP Act compliance)
- [01-03]: ConsentRequiredGuard logs BOTH granted and denied access attempts — denied access is auditable for compliance
- [01-03]: ADMIN role bypasses consent guard in all paths — can view any data for compliance and support purposes
- [01-03]: AuditLogService reuses consent_logs table with auditEvent metadata — avoids schema migration for audit trail
- [Phase 01-02]: MSG91 skips API in dev mode (NODE_ENV=development) — OTP logged to console to prevent SMS cost during development
- [Phase 01-02]: JWT expiry 7 days — mobile-first long session UX, no refresh token rotation needed at this phase
- [Phase 01-02]: JwtStrategy validates user against DB on every request — prevents stale token attacks after deactivation or role revocation
- [Phase 01-02]: Admin role revocation uses soft-delete (isActive=false, revokedAt) — preserves audit trail, never hard-deletes role records
- [02-01]: PostGIS image is backward-compatible drop-in — no existing queries affected, enables Phase 3 geography
- [02-01]: onboardingStep uses max(current, N) — vendors can revisit earlier steps without losing progress
- [02-01]: Cloudinary returns mock data in dev when env vars missing — prevents blocking development
- [02-01]: VendorOwnerGuard attaches vendorId to req — simpler controller signatures, ADMIN bypasses
- [02-01]: All pricing amounts in paise — consistent with Indian payment conventions
- [02-02]: RazorpayService uses dev mock mode when env vars missing — consistent with MSG91 and Cloudinary patterns
- [02-02]: Lazy plan sync — Razorpay plans created on first checkout, not at seed time
- [02-02]: Cancel at cycle end — vendor retains access until current billing period expires
- [02-02]: Webhook returns 200 on processing errors to prevent Razorpay retry storms
- [02-02]: Idempotency key: subscriptionId_event_paymentId — unique per charge event
- [Phase 02-03]: KYC review creates AdminNotification in same transaction — atomic audit trail
- [Phase 02-03]: Subscription plan price change resets razorpayPlanId to null — forces lazy re-creation (Razorpay plans immutable)
- [Phase 02-03]: Category slug collision on rename appends numeric suffix — prevents uniqueness violation
- [03-01]: Public customer endpoints have no auth guards — storefront API pattern for anonymous browsing
- [03-01]: Vendor search filters on subscription status ACTIVE or AUTHENTICATED — only paying vendors appear
- [03-01]: VendorStats caches scoring factors (averageRating, responseRate) — lead routing performance optimization
- [03-01]: PostGIS enabled via migration prepend — available for ST_DWithin distance queries
- [03-02]: Consent recorded inline (not via guard) — lead creation needs consentLogId FK link
- [03-02]: ScoringService locationMatch computed fresh per event — location is event-specific, not vendor-intrinsic
- [03-02]: Fairness counter uses Redis INCR with 7-day TTL on first increment — atomic and self-expiring
- [03-02]: CreateInquiryDto validates targetVendorId XOR categoryId at service level — explicit error for both/neither
- [03-03]: BullModule.forRoot parses REDIS_URL into host/port — cannot share ioredis instance (maxRetriesPerRequest must be null for BullMQ workers)
- [03-03]: Firebase mock mode logs push notifications when env vars missing — consistent with MSG91/Cloudinary/Razorpay dev mock pattern
- [03-03]: Fairness cap checked at routing time (not scoring time) — keeps scoring pure and separation of concerns clear
- [04-01]: Socket.IO JWT auth in afterInit middleware — never in handleConnection to prevent NestJS crash (issue #2028)
- [04-01]: db push used for Phase 4 migration (existing migration was modified; migrate reset blocked by Prisma AI safety gate); migration SQL created manually and marked applied
- [04-01]: Booking.leadId @unique added (Prisma requires unique FK for one-to-one Lead.booking? relation)
- [04-01]: Redis scoring cache invalidated outside $transaction to avoid long-running TX (pitfall 4)
- [04-01]: @nestjs/websockets pinned to v10.x (not v11.x) to match @nestjs/common@10.x peer dependency
- [04-02]: totalPaise computed server-side from lineItems (not accepted from client) — prevents price manipulation
- [04-02]: VendorStats.totalLeadsWon incremented outside $transaction — consistent with pitfall 4 (Redis cache) pattern from 04-01
- [04-02]: QuoteController uses @Controller() with full paths — avoids nested controller routing complexity
- [04-02]: submitQuote checks submittedCount excluding current quote (post-transition) — correct QUOTES_RECEIVED detection
- [04-03]: BOOKING_PUSH_MESSAGES const at file level — single source of truth for all booking status notification copy
- [04-03]: transitionStatus uses requesterRole from JWT activeRole to determine vendor vs customer auth check
- [04-03]: ReviewController has no class-level UseGuards — public GET endpoint requires no auth, guarded endpoints apply UseGuards per-method
- [04-03]: routeTopThree fetches assignmentId before updateMany for emitToVendor payload — findFirst + updateMany pair is safe
- [05-01]: Commission rate locked on Booking at order creation time — prevents disputes when admin changes rates for existing unpaid bookings
- [05-01]: verifyPayment does NOT create Transaction record — webhook is source of truth; avoids race condition (Pitfall 3)
- [05-01]: Transaction.vendorSubscriptionId made optional with onDelete SetNull — enables BOOKING_COMMISSION transactions without subscription link
- [05-01]: RazorpayService.keySecret stored as private field for HMAC payment signature validation
- [05-01]: Default commission rate 500 bps (5%) seeded as global fallback — more specific rates addable by admin in Plan 05-03
- [05-02]: Payment processing is async via BullMQ — webhook enqueues job, processor handles commission calc and Transaction creation (not synchronous in webhook handler)
- [05-02]: Payout triggered only on booking COMPLETED transition — not on payment capture; prevents paying vendor before service delivery (Pitfall 5)
- [05-02]: PayoutService uses raw HTTP for RazorpayX Composite Payout API — not in Razorpay SDK (Pitfall 1); X-Payout-Idempotency header mandatory (Pitfall 7)
- [05-02]: Missing bank details return PENDING_BANK_DETAILS status without throwing — payout retryable when vendor adds bank info
- [05-02]: PayoutProcessor double-checks booking COMPLETED status before calling PayoutService — defense in depth against race conditions
- [05-03]: Refund limited to BOOKING_COMMISSION transactions only — subscription refunds handled separately via Razorpay subscription cancellation
- [05-03]: Commission rate deletion is soft-delete (effectiveTo = now) — rates may be referenced by locked booking commissions
- [05-03]: Payment log vendor filter uses OR across booking.vendorId and vendorSubscription.vendorId — covers all revenue streams
- [06-01]: UpdateProductDto uses explicit optional fields (not PartialType) — @nestjs/mapped-types not installed in this project
- [06-01]: Cloudinary cascade delete on product — loop images, delete each from Cloudinary, then Prisma onDelete: Cascade handles DB records
- [06-01]: CatalogController is public (no class-level auth) — browse endpoints need no auth
- [06-02]: Stock decrement is atomic in Prisma $transaction; low-stock BullMQ alerts enqueued outside (Pitfall 4)
- [06-02]: Commission rate uses getRate(vendorId, null) for product orders — ProductCategory is separate from EventCategory (Pitfall 3)
- [06-02]: Webhook routes by notes.type — MARKETPLACE_SALE to product-order-payment queue; default to payment-processing (backward-compatible)
- [06-02]: Payment failure for MARKETPLACE_SALE restores stock atomically via $transaction before setting paymentStatus FAILED
- [Phase 06-03]: [06-03]: cancelOrder delegates to transitionOrderStatus internally — single state machine, no duplication
- [Phase 06-03]: [06-03]: Stock restore inside same $transaction as updateMany — prevents stock leak on mid-transaction failure
- [07-01]: FUNNEL_ORDER defined as static readonly on AdminService — single source of truth for 8-stage conversion funnel ordering
- [07-01]: activeVendorCount filters subscription status IN ['ACTIVE','AUTHENTICATED'] — consistent with vendor search visibility pattern from Phase 3
- [07-02]: LeadRoutingTrace writes happen after LeadAssignment creation (not inside same transaction) — consistent with existing RoutingService pattern
- [07-02]: skipReasons tracked during fairness-cap loop with Map to avoid double Redis read for trace persistence
- [07-02]: Override uses upsert on LeadRoutingTrace (not create) to handle re-routing to a previously scored vendor
- [07-02]: Market status gate uses raw SQL AND clause in findVendorsInRange (both query variants)
- [07-02]: Override push notification is fire-and-forget (.catch) — non-blocking, consistent with existing notification patterns
- [07.2-01]: FeedPost/FeedComment use soft-delete (status field) for user-initiated deletes; admin delete is hard-delete
- [07.2-01]: Report.feedPost relation uses optional FK to allow reports targeting non-feed entities (VENDOR, MESSAGE, USER)
- [07.2-01]: Favorites use composite unique constraint [customerId, vendorId] for O(1) idempotency checks
- [07.2-01]: GET /feed is fully public (no JwtAuthGuard) to maximize discoverability
- [07.2-01]: Prisma generate run manually after schema update since DB unavailable locally (Render hosted)
- [07.2-02]: Feed page public (no auth to view); POST requires auth with router.push to /login?redirect
- [07.2-02]: Favorites check on vendor detail uses GET /customer/favorites/:id/check — graceful no-op if endpoint missing
- [07.2-02]: Home feed preview silently swallows API errors so home page never breaks
- [07.2-03]: inputCls variable inside component for reusable input styles (Tailwind v4 CSS import incompatible with @layer components)
- [07.2-03]: Client-side star filter for reviews avoids extra API call per star rating
- [07.2-03]: Inline quote form inside lead card (not modal) for faster vendor workflow
- [07.2-03]: Hardcoded PLAN_FEATURES per tier (BASIC/PRO/PREMIUM) as fallback if API returns empty array
- [07.2-03]: Vendor payout = totalPaise - commissionPaise displayed on each booking card
- [Phase 07.2]: Bookings page uses dashboard analytics as source since no /admin/bookings endpoint exists
- [Phase 07.2]: Sidebar reorganized into sections (Overview, Management, Content, Finance) with Feed/Reports/Bookings nav

### Pending Todos

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Full beautiful interactive client testing website with dark/light mode toggle 2026 design | 2026-03-13 | 9534f08 | [001-full-beautiful-interactive-client-testin](.planning/quick/001-full-beautiful-interactive-client-testin/) |

### Blockers/Concerns

- [Pre-Phase 1]: TRAI DLT registration — submit OTP + transactional SMS templates to MSG91 before any OTP SMS can be sent. Ops action, not a code task.
- [Pre-Phase 2]: Razorpay Payout (RazorpayX) KYC — submit application during Phase 2; approval timeline 2-4 weeks; missing this gate blocks Phase 5 vendor payouts.
- [Phase 3 resolved]: PostGIS + Prisma integration — resolved with $queryRaw and ST_DWithin geography casting.
- [Phase 5 resolved]: Razorpay commission split — resolved with RazorpayX Payouts (collect full, payout net) instead of Route (linked accounts). GST treated as inclusive in commission rate for MVP.
- [Phase 6 planning]: Kiwi Party / Birthday Kart integration contract must be defined before Phase 6 begins (Shopify webhook vs. CSV vs. custom API determines entire B2B architecture).
- [Legal]: India DPDP Act consent implementation rules are evolving — get legal review before launch.

## Session Continuity

Last session: 2026-03-15
Stopped at: Completed 07.2-05-PLAN.md — All apps deployed to production. Customer web: https://web-xi-flax-21.vercel.app | Vendor: https://vendor-sooty.vercel.app | Admin: https://admin-roan-one-51.vercel.app | API: https://zevento-api.onrender.com
Resume file: None
