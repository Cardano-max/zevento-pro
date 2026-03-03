# Project Research Summary

**Project:** Zevento Pro
**Domain:** Multi-sided event marketplace (lead generation + service booking + B2B product supply) — India
**Researched:** 2026-03-04
**Confidence:** MEDIUM

## Executive Summary

Zevento Pro is a three-sided marketplace connecting event seekers with planners/decorators and B2B product suppliers, targeting Surat and Ahmedabad initially with pan-India expansion planned. The platform differentiates itself from JustDial and Sulekha by curating a Top 3 vendor shortlist via a scoring algorithm (rather than blasting leads to every vendor or maintaining a passive directory), enforcing in-platform bookings and payments to capture commission, and adding a B2B product procurement layer for planners. The recommended architecture is a monorepo with a NestJS modular monolith API, three separate Next.js frontends (customer, vendor, admin), PostgreSQL as the primary store, and Redis for score caching and OTP handling. This stack closely mirrors how Urban Company and Thumbtack operate at the relevant scale.

The recommended build order is strict: authentication and multi-role identity schema must be locked before any other module ships, because retrofitting a role-per-row schema to a role-table schema after production data exists is a full data migration. Vendor onboarding and subscription billing must be functional before the lead routing engine is enabled, because the scoring algorithm weights subscription tier at 30%. The B2B product marketplace is an independent revenue stream that should only be built after core lead-to-booking-to-payment conversion is validated. The overall approach is to ship a focused MVP in two cities, validate conversion and vendor NPS, then expand.

The dominant risk profile is three-part: cold-start dynamics (seeding supply before demand exists causes vendor churn before the flywheel starts), geospatial architecture shortcuts (using city-name strings instead of lat/lng + PostGIS breaks lead matching at city expansion), and commission leakage (WhatsApp-native Indian users will bypass the platform the moment vendor contact details are exposed too early). All three risks have known prevention patterns and must be addressed in Phase 1 schema decisions, not deferred.

---

## Key Findings

### Recommended Stack

The core stack is Next.js 15 (full-stack, App Router), TypeScript, PostgreSQL 16, Prisma ORM, Redis, Node.js 22 LTS, and NestJS for the API layer. Payment processing is Razorpay (subscriptions, lead purchases, commissions, payouts). Authentication is custom OTP logic (MSG91 for SMS delivery) wrapped with Auth.js v5 session management. Async processing uses BullMQ on Redis for job queues and Socket.IO for real-time vendor notifications. Firebase Admin SDK handles push notifications. Cloudinary covers media storage for vendor portfolios and product images. The monorepo is managed with pnpm workspaces.

This is a well-established stack for Indian marketplace products at this scale. All version numbers require pre-development verification at official sources because research tooling was unavailable and training data has a cutoff of August 2025.

**Core technologies:**
- Next.js 15 + React 19: Full-stack framework — App Router reduces client bundle; ISR for vendor listing pages; API routes eliminate a separate Express server
- TypeScript 5.x: Type safety across full codebase — marketplace data models are complex (Lead, Vendor, Score, Assignment, Subscription, Order); types eliminate interface bugs
- PostgreSQL 16: Primary relational database — marketplace data is fundamentally relational; JSONB covers flexible vendor profile fields without schema churn
- Prisma ORM: Database access layer — type-safe codegen accelerates onboarding; migrations built-in
- Redis 7.x: Caching + OTP store + BullMQ queues — vendor scoring algorithm needs sub-millisecond reads; OTP TTL expiry is a native use case
- NestJS: Modular API framework — module boundaries enforce domain separation; Guards + Interceptors handle auth and ownership checks cleanly
- Razorpay: Payment gateway — covers all four revenue streams (subscriptions, lead purchase, booking commission, marketplace margin) in one SDK; best developer experience in Indian market
- MSG91: OTP SMS — dominant Indian OTP provider; TRAI DLT compliance; better delivery on Airtel/Jio/BSNL than Twilio
- BullMQ + Socket.IO: Async lead routing + real-time notifications — lead routing must be non-blocking; Socket.IO scales horizontally via Redis adapter

### Expected Features

**Must have (table stakes — v1 launch):**
- OTP phone authentication with rate limiting (3/10 min per phone) — identity foundation; email signup has very low conversion in India
- Customer inquiry form (event type, date, city, budget, guest count) — the lead creation entry point; without this there is no product
- Lead routing algorithm (Top 3 vendor shortlist by subscription tier + rating + response rate + location + fairness rotation) — core product promise
- Vendor profile with portfolio gallery and verified badge — customers need visual proof before trusting a vendor
- Vendor lead inbox with push notification and WhatsApp alert — vendors must know about leads immediately; missed leads = churn
- Lead acceptance and quote submission flow — vendor-to-customer communication loop
- Vendor subscription plans (minimum 2 tiers) with Razorpay billing — revenue foundation
- Booking confirmation and status tracking (Inquiry > Quoted > Booked > Completed) — closes the loop
- Verified post-booking reviews (gated behind booking completion) — social proof; fraud-resistant
- Admin panel: user management, lead log, vendor KYC approval, payment view — operator visibility
- WhatsApp and SMS notifications for all booking events — table stakes in India 2025+

**Should have (differentiators — v1.x after validation):**
- Lead credit wallet (pay-per-lead alternative to subscription) — unlocks non-subscription vendors; add when subscription conversion stalls
- Booking calendar with vendor availability blocking — reduces double-booking complaints
- Vendor response rate tracking affecting lead score — creates game mechanic that improves customer experience
- In-app messaging (replace off-platform WhatsApp for pre-booking communication) — add when lead volume creates off-platform churn risk
- Supplier product catalog and B2B planner-to-supplier ordering — second revenue stream; activate when planners are active
- Vendor success score / profile strength meter — gamified completeness reduces churn
- Event inspiration gallery with SEO content — organic traffic acquisition; add when paid acquisition costs rise

**Defer to v2+:**
- AI-assisted event brief from natural language (GPT API) — requires lead volume data to justify API costs
- Milestone payment escrow — complex; add when average booking value exceeds Rs 50,000
- Vendor portfolio AI photo tagging — nice-to-have; not revenue-impacting in early stage
- Real-time availability signal in shortlist — requires high vendor calendar adoption first
- Multi-city admin tooling with city-specific routing config — defer until second city goes live

**Anti-features to explicitly avoid:**
- Open public vendor directory with direct contact — disintermediates the platform (JustDial failure mode)
- Real-time bidding / auction per lead — race to the bottom; Urban Company abandoned this
- Free tier for vendors with full lead access — ghost leads destroy customer experience
- Unverified reviews from any user — gameable; Sulekha example
- Simultaneous pan-India launch — kills quality in all cities; Urban Company's city-by-city strategy is the model

### Architecture Approach

The system uses a modular monolith pattern: a single NestJS API organized into strictly-bounded domain modules (Auth, Leads, Bookings, Vendors, Subscriptions, Payments, Notifications, Products, Orders, Analytics, Admin), communicating through injected service interfaces and in-process NestJS EventEmitter events rather than direct cross-module imports or external message queues. Three separate Next.js applications serve customer, vendor/planner, and admin UIs, sharing a `packages/shared` package for Zod schemas and TypeScript types. Microservices are explicitly deferred until a specific module's load profile diverges at Phase 3 scale.

**Major components:**
1. Auth Module — OTP send/verify via MSG91, JWT issue with role claims, session management via Auth.js; Redis stores hashed OTPs with TTL
2. Lead Module (Routing Engine) — lead creation with consent tracking, ScoringService (pure deterministic function: subscription tier 30%, rating 20%, response rate 20%, location 20%, fairness rotation 10%), Redis score factor cache, Top 3 assignment, EventEmitter `lead.routed` event dispatch
3. Subscription Module — Razorpay recurring billing, plan tier enforcement, Redis score cache invalidation on tier change
4. Vendor CRM Module — lead dashboard, quote generator, booking calendar, analytics
5. Payment Module — Razorpay Orders API, commission calculation, webhook idempotency via `webhook_events` table + BullMQ processing
6. Notification Module — Firebase Admin SDK push, MSG91 SMS; subscribed to domain events (lead.routed, payment.confirmed)
7. B2B Order Module — supplier product catalog, cart (Redis session), order lifecycle, inventory tracking, Cloudinary media
8. Admin Module — vendor KYC approval, routing config, analytics, manual lead override

**Key patterns:**
- Role-Based Guard + Resource Ownership Check on every protected route (prevents IDOR vulnerabilities)
- Vendor score caching: pre-computed score factors stored in Redis hash (`vendor:{id}:score_factors`), invalidated only on subscription/rating/response rate change — makes Top 3 routing sub-10ms
- Event-driven lead lifecycle: routing → notifications → analytics decoupled via NestJS EventEmitter
- Users table holds identity only; `vendor_profiles` and `customer_profiles` are separate tables with FK to users — no nullable columns on the base user record
- Markets table (not city string): `markets(id, city, state, launch_date, status)` from day 1 enables city expansion without data migration

### Critical Pitfalls

1. **Cold-start on the wrong side** — Seed demand (Google/Meta ads targeting event searchers) before opening vendor onboarding. Use existing customer base (Kiwi Party / Birthday Kart) as captive early demand. Give early vendors a guaranteed minimum lead flow. Delay product supplier marketplace until planner/seeker liquidity exists.

2. **City-string geography that blocks expansion** — Never use `city = 'Surat'` as the join key. Store vendor service radius as lat/lng + radius (km). Use PostGIS `ST_DWithin` with GIST spatial indexes. Model cities as a `markets` table with status gates. This is a schema decision that cannot be retrofitted cheaply.

3. **Single-role identity model** — Model roles as many-to-many from day 1: `user_roles(user_id, role, context_id)`. An Indian vendor who runs both a decor business and sells supplies needs two roles on one phone number. This cannot be retrofitted without a full auth migration.

4. **Razorpay webhook double-processing** — Immediately store `razorpay_payment_id` in a `webhook_events` table on receipt, return HTTP 200, enqueue processing to BullMQ. Before processing, check if `payment_id` already has status PROCESSED. Use unique constraint on `(payment_id, event_type)` as hard idempotency guard.

5. **Commission leakage via off-platform bookings** — Mask vendor contact details until a logged "interest" event. Reveal phone only after the seeker has created a formal lead and the vendor has accepted it through the platform. Track "contact revealed" vs. "booking created" events; a large gap is the signal.

6. **Revenue model not isolated in billing layer** — Design a `transactions` table with `transaction_type` enum (SUBSCRIPTION, LEAD_PURCHASE, BOOKING_COMMISSION, MARKETPLACE_SALE) from day 1. Each Razorpay order carries this type in the `notes` field. Webhook handlers route to isolated per-type processing functions.

7. **OTP without rate limiting and DLT registration** — Rate limit: max 3 OTPs per phone per 10-minute window. Store OTPs hashed (SHA-256). DLT registration with TRAI must be submitted before the first OTP SMS is sent — unregistered templates are blocked by Indian operators.

---

## Implications for Roadmap

Based on the combined research, the architecture's dependency chain and the pitfall-to-phase mapping suggest a 7-phase roadmap. The order is not negotiable — each phase creates hard prerequisites for the next.

### Phase 1: Foundation (Schema, Auth, Multi-Role Identity)

**Rationale:** Auth and identity schema are the most irreversible decisions in this system. Single-role schema retrofitted to multi-role requires a full auth migration. City-string geography retrofitted to PostGIS requires data migration plus index rebuilds. Both are unacceptably expensive post-launch. This phase exists to lock in the decisions that cannot be changed later.

**Delivers:** Working OTP authentication, multi-role session management, markets table, user_roles table, Prisma schema with PostGIS-ready geography columns, Docker Compose local environment, CI/CD pipeline.

**Addresses (from FEATURES.md):** OTP phone authentication (P1), admin panel foundation (roles, session), infrastructure for all downstream features.

**Avoids (from PITFALLS.md):** Multi-role auth conflation (Pitfall 3), city-string geography (Pitfall 2 schema part), OTP without rate limiting (Pitfall 9), DLT registration delay (SMS ops must start in this phase).

**Research flag:** Standard patterns. OTP + JWT + Next.js App Router auth are well-documented. NestJS Guards are documented. Skip `/gsd:research-phase` unless MSG91 DLT registration process needs investigation.

---

### Phase 2: Vendor Onboarding and Subscription Billing

**Rationale:** The scoring algorithm weights subscription tier at 30%. Lead routing cannot produce meaningful results until vendors exist with subscription data. Admin KYC approval must be functional before any vendor receives leads. Razorpay Payout KYC approval takes 2-4 weeks — the application must be submitted in this phase, not Phase 4.

**Delivers:** Vendor profile creation with progressive onboarding (minimum viable profile gate), service area definition with map UI, subscription plan selection, Razorpay recurring billing integration, admin KYC approval queue, vendor activation flow.

**Addresses (from FEATURES.md):** Vendor onboarding / profile setup (P1), subscription plan selection (P1), vendor portfolio gallery (P1), admin panel vendor verification (P1).

**Avoids (from PITFALLS.md):** Onboarding friction (Pitfall 6 — progressive disclosure), revenue model isolation (Pitfall 4 — transactions table with SUBSCRIPTION type from first payment), Razorpay Payout KYC delay (start application now).

**Research flag:** May need `/gsd:research-phase` for Razorpay Subscriptions webhook event map and MSG91 DLT template registration process. Both have docs but the India-specific compliance steps are time-sensitive.

---

### Phase 3: Lead Routing Engine (Core Product)

**Rationale:** This is the highest-value and highest-risk module in the system. Lead routing is the core product promise. Scoring service correctness, Redis cache invalidation logic, and geospatial matching are all critical to vendor trust and customer experience. Only ships after approved vendors with subscriptions exist to be routed to.

**Delivers:** Customer inquiry form with consent tracking, ScoringService (weighted formula, Redis cache), Top 3 vendor assignment with PostGIS distance matching, fairness rotation (40% diversity cap), BullMQ async routing jobs, Firebase push and MSG91 SMS notification to vendors on lead assignment, lead inbox in vendor dashboard.

**Addresses (from FEATURES.md):** Customer inquiry form (P1), lead routing algorithm (P1), vendor lead inbox + notifications (P1), push/WhatsApp lead alerts (P1).

**Avoids (from PITFALLS.md):** Geographic precision failure (Pitfall 2 — PostGIS engine part), synchronous lead scoring blocking API response (Performance Traps), N+1 on lead listing, Redis score cache with proper invalidation.

**Research flag:** Needs `/gsd:research-phase` during planning. Scoring algorithm weight tuning, PostGIS + Prisma integration (Prisma doesn't natively support PostGIS — raw SQL or prisma-extension-postgis needed), and BullMQ worker deployment on Railway alongside Vercel all need detailed technical research.

---

### Phase 4: Vendor CRM and Booking Flow

**Rationale:** Vendors need tools to respond to leads they are now receiving. Quote submission and booking confirmation close the loop from inquiry to commitment and are the prerequisite for payment collection. Booking calendar reduces double-booking complaints that appear once lead volume is live.

**Delivers:** Lead dashboard with quality score display and lead prioritization, quote builder with line items and validity period, booking confirmation flow (customer accepts quote → booking created), booking calendar with vendor date blocking, status timeline (Inquiry > Quoted > Booked > Completed), post-booking review invitation trigger.

**Addresses (from FEATURES.md):** Quote submission (P1), booking confirmation (P1), booking calendar (P2), lead acceptance/rejection (P1), verified post-booking reviews (P1).

**Avoids (from PITFALLS.md):** Contact exposure too early (Pitfall 8 — contact masking enforced at this phase), no-show notifications (UX pitfalls — 48h and 2h reminders), vendor dashboard cognitive overload (UX pitfalls — show lead quality score and budget inline).

**Research flag:** Standard patterns. Booking state machine is well-documented. Skip `/gsd:research-phase` unless milestone payment escrow is pulled forward (deferred to v2).

---

### Phase 5: Payments and Commission Settlement

**Rationale:** Payment collection is the final prerequisite for real revenue capture. Commission leakage prevention (contact masking) should already be in place from Phase 4. This phase closes the monetary loop: customer pays, platform captures commission, vendor receives net payout.

**Delivers:** Razorpay Orders API integration for booking payments, commission calculation from rate table (not hardcoded), `webhook_events` table with idempotency, BullMQ payment processing workers, vendor payout via Razorpay Payouts (requires Phase 2 KYC approval), `transactions` ledger table with all four revenue stream types, admin payment management and refund flows.

**Addresses (from FEATURES.md):** Payment collection (P1), vendor payout, admin subscription and payment management (P1), platform commission capture.

**Avoids (from PITFALLS.md):** Webhook double-processing (Pitfall 5), revenue model not isolated (Pitfall 4), client-sent payment amount trust (Security Mistakes), Razorpay signature verification on all webhooks (Integration Gotchas).

**Research flag:** Needs `/gsd:research-phase` for Razorpay commission split mechanics (whether split happens at order creation or via payout after capture), Razorpay Payouts API current KYC requirements, and GST handling (GST rates vary by service category — hardcoding 18% is only acceptable at MVP if all categories are the same rate).

---

### Phase 6: B2B Product Marketplace

**Rationale:** Independent revenue stream that only makes sense after the core lead-to-booking-to-payment flywheel is validated. Planners active on the platform create natural demand for supply procurement. Inventory sync with existing supply chains (Kiwi Party / Birthday Kart) must be contracted before development begins.

**Delivers:** Supplier product catalog management (name, SKU, price, rental period, images via Cloudinary), inventory tracking with per-date availability, B2B planner-to-supplier ordering flow, Razorpay checkout for product orders, order lifecycle (Pending > Confirmed > Dispatched > Delivered), platform margin calculation, Zevento vs. supplier fulfillment label distinction.

**Addresses (from FEATURES.md):** Supplier product catalog (P2), inventory tracking (P2), B2B planner-to-supplier ordering (P2), order management (P2).

**Avoids (from PITFALLS.md):** Inventory sync failures causing oversell (Pitfall 10 — integration contract with Kiwi Party / Birthday Kart must be defined before this phase begins), product marketplace mixed provenance confusion (UX pitfalls — label fulfillment source clearly).

**Research flag:** Needs `/gsd:research-phase` for the Kiwi Party / Birthday Kart integration contract (Shopify webhook vs. CSV vs. custom API), inventory reservation (soft-hold vs. hard-deduct logic), and B2B net-30 credit term handling if that is in scope.

---

### Phase 7: Analytics, Admin Hardening, and Expansion Tooling

**Rationale:** Analytics dashboards read data that all operational modules produce; building them before the data exists is premature. Admin hardening (IP allowlist, audit logs, dispute resolution) and multi-city expansion tooling (market status gates, routing density thresholds, city admin roles) are required before expanding beyond the two launch cities.

**Delivers:** Admin analytics dashboard (daily leads, conversions, revenue, active vendor count), vendor analytics dashboard (leads received, conversion rate, booking value, lead credits remaining), city expansion tooling (market status management, minimum vendor density gate for algorithmic routing, city admin roles), dispute resolution ticket system, subscription renewal reminders (14d/7d/3d/1d), read-only Postgres replica for analytics queries.

**Addresses (from FEATURES.md):** Platform analytics dashboard (P1 admin), vendor earnings dashboard (P2), multi-city admin tooling (P3), dispute resolution (P2).

**Avoids (from PITFALLS.md):** Scaling city-to-national without market model (Pitfall 7 — the markets table exists from Phase 1; this phase adds the routing gate logic), no minimum vendor density gate (Technical Debt Patterns).

**Research flag:** Standard patterns for dashboard queries (materialized views, read replicas). May need `/gsd:research-phase` for Neon Postgres read replica setup on Vercel if self-hosted Postgres is not selected.

---

### Phase Ordering Rationale

- Auth before everything: no protected route works without it; and the schema decisions (multi-role, markets table, geography columns) must be made before the first user record is created.
- Vendors before leads: the routing engine cannot assign leads if no approved vendors with subscription data exist; and vendor scoring weight depends on subscription tier.
- Lead engine before CRM: vendors need leads to arrive before quote/booking response flows have purpose.
- Booking before payments: payment collection requires a booking record to attach commission calculation to.
- B2B marketplace after core flywheel: independent revenue stream that requires planner liquidity from the lead marketplace to create natural demand.
- Analytics last: dashboards read operational data; build the data producers first.

This order matches the dependency chain in ARCHITECTURE.md exactly, and maps all critical pitfalls to their earliest preventable phase.

---

### Research Flags

**Phases needing `/gsd:research-phase` during planning:**

- **Phase 3 (Lead Routing Engine):** PostGIS + Prisma integration (Prisma has no native PostGIS support; requires raw SQL or extension library), BullMQ on Railway alongside Vercel, scoring algorithm weight validation.
- **Phase 5 (Payments):** Razorpay commission split mechanics, current Razorpay Payout KYC requirements and timelines, GST category-specific rate handling.
- **Phase 6 (B2B Marketplace):** Kiwi Party / Birthday Kart integration contract, inventory reservation logic, B2B credit term mechanics.

**Phases with well-documented patterns (skip research-phase):**
- **Phase 1 (Foundation):** OTP + JWT + NestJS Guards + Prisma schema are all thoroughly documented. Only exception: MSG91 DLT registration process should be verified before development starts (not a code research question — an ops action item).
- **Phase 4 (CRM + Booking):** Booking state machine, quote builder, calendar UI are standard patterns with abundant examples.
- **Phase 7 (Analytics):** Dashboard query patterns (materialized views, TanStack Table + Recharts) are well-documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Context7 and WebFetch unavailable; all version numbers from training data (cutoff Aug 2025). Core technology choices (Next.js, PostgreSQL, Redis, NestJS, Razorpay) are well-established and high-confidence. Version pins require pre-development verification at official sources. |
| Features | MEDIUM | Competitor analysis (Urban Company, Sulekha, JustDial, Thumbtack) from training data. Feature dependency map is logical and internally consistent. Anti-feature list is grounded in documented Indian marketplace failure patterns. Verify competitor feature sets have not evolved significantly since Aug 2025. |
| Architecture | MEDIUM-HIGH | Modular monolith pattern, NestJS module boundaries, Redis scoring cache, PostGIS for geospatial matching, event-driven lead lifecycle — all are established patterns with high-confidence sources. DPDP Act compliance requirements are LOW confidence (law is evolving; get legal review before launch). |
| Pitfalls | MEDIUM-HIGH | Cold-start dynamics, webhook idempotency, multi-role auth, geospatial schema — all backed by documented real-world failure patterns (Urban Company, JustDial, Stripe/Razorpay official guidance). Razorpay Payout KYC timelines and DLT registration enforcement status require pre-development verification. |

**Overall confidence:** MEDIUM

The technology choices and architecture patterns are well-validated from multiple training sources. The India-specific compliance landscape (TRAI DLT, DPDP Act, Razorpay Payout KYC) is the primary area of LOW confidence and requires live verification before Phase 1 development begins.

---

### Gaps to Address

- **Razorpay Payout KYC timeline:** Verify current approval timeline and required documents at razorpay.com/docs before Phase 2 ends. Approval takes 2-4 weeks; missing this gate blocks Phase 5 payout feature.
- **TRAI DLT registration:** Submit DLT registration for all OTP and transactional SMS templates before Phase 1 development ends. Unregistered templates are operator-blocked; no OTP = no auth = no product. Verify current enforcement status and process at trai.gov.in and msg91.com/help.
- **India DPDP Act consent requirements:** The Digital Personal Data Protection Act 2023 governs how phone numbers, event details, and financial data are collected, stored, and used. Explicit legal review required before launch. Consent record logging (already in the data model) is the right starting point, but implementation rules are still evolving.
- **PostGIS + Prisma integration:** Prisma ORM does not natively support PostGIS geospatial types. Research whether `prisma-extension-postgis` or raw SQL queries are the correct approach for the routing engine before Phase 3 sprint planning.
- **Tailwind CSS v4 stability:** Tailwind v4 uses a new CSS-native engine. If the team encounters instability with Next.js integration, fall back to Tailwind v3.4 which is production-proven. Verify Next.js + Tailwind v4 integration guide before adopting v4.
- **Auth.js v5 stability status:** Auth.js v5 was in beta at training cutoff. Verify current stable release status at authjs.dev before adopting for production.
- **Kiwi Party / Birthday Kart integration contract:** Must be defined before Phase 6 begins. Whether the existing supply chain runs on Shopify, a custom system, or spreadsheets determines the entire B2B marketplace integration architecture.

---

## Sources

### Primary (HIGH confidence)
- BullMQ + Redis async job queue pattern for marketplace lead routing — well-documented, stable API
- PostGIS `ST_DWithin` + GIST spatial indexing — well-documented, production-proven
- Multi-role RBAC pattern (user_roles table, JWT claims) — established B2B SaaS pattern
- Webhook idempotency pattern (unique constraint + background queue) — official Stripe and Razorpay guidance
- Cold-start problem in two-sided markets — academic research (Eisenmann, Parker, Van Alstyne); Urban Company city-by-city strategy
- NestJS module boundaries, Guards, Interceptors, EventEmitter — official NestJS documentation patterns
- Firebase Admin SDK server-side push (FCM v1 API) — official Firebase documentation pattern
- Redis read-through cache with invalidation on write — standard caching pattern

### Secondary (MEDIUM confidence)
- Urban Company, Thumbtack, WeddingWire, Sulekha, JustDial feature and architecture patterns — training data, observed through Aug 2025; verify against current product before roadmap finalization
- Razorpay Subscriptions, Orders, Webhooks API patterns — training data; verify current webhook payload format at razorpay.com/docs
- MSG91 DLT compliance for Indian transactional SMS — training data; verify current DLT onboarding process before Phase 1
- Next.js 15 App Router, Auth.js v5, Tailwind CSS v4 — training data; verify current stable versions before pinning in package.json
- Vercel + Neon Postgres + Upstash Redis serverless deployment pattern — training data; verify current pricing and limitations

### Tertiary (LOW confidence — requires pre-development verification)
- India DPDP Act (Digital Personal Data Protection Act 2023) implementation rules and consent requirements — law passed 2023, implementation rules still evolving; get legal review
- Razorpay Payout (RazorpayX) KYC requirements and approval timeline for new marketplace accounts — verify at razorpay.com/docs/razorpayx before Phase 2
- GSTIN verification API uptime SLA and current rate limits — government API with no official SLA; verify at taxpayerapi.gst.gov.in
- WhatsApp Business API template pre-approval timeline — Meta approval process varies; budget extra time before Phase 1 notification features ship

---

*Research completed: 2026-03-04*
*Ready for roadmap: yes*
