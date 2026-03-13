# Roadmap: Zevento Pro

## Overview

Zevento Pro is a three-sided Indian event marketplace built in seven sequential phases, each one unlocking the next. The build order is non-negotiable: identity schema and auth are locked first (Phase 1) because multi-role retrofits require full data migrations; vendor supply and subscription billing ship before the lead engine (Phases 2-3) because the scoring algorithm weights subscription tier at 30%; booking and payment flows follow (Phases 4-5) to close the monetary loop; the B2B product marketplace ships after core flywheel validation (Phase 6); analytics dashboards come last because they read data that all operational modules produce (Phase 7).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Lock auth, identity schema, privacy infrastructure, and dev environment before any business logic ships
- [x] **Phase 2: Vendor Onboarding and Subscriptions** - Vendors can register, build profiles, and activate subscription billing; admins can approve KYC
- [x] **Phase 3: Lead Routing Engine** - Customers can submit event inquiries that get routed to the Top 3 matched vendors in real time
- [ ] **Phase 4: Vendor CRM and Booking Flow** - Vendors can respond to leads, submit quotes, manage calendars, and close bookings; customers can accept quotes and leave reviews
- [ ] **Phase 5: Payments and Commission Settlement** - Customer payments processed, platform commission captured, vendor payouts disbursed
- [ ] **Phase 6: B2B Product Marketplace** - Suppliers list products; planners browse, order, and track B2B supply procurement
- [ ] **Phase 7: Analytics and Admin Hardening** - Admin analytics dashboard, lead flow override, and expansion readiness tooling

## Phase Details

### Phase 1: Foundation
**Goal**: Users can authenticate with OTP, the system enforces multi-role identity and consent-based privacy from day one, and the dev environment is ready for all downstream modules to build on
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PRIV-01, PRIV-02, PRIV-03, PRIV-04, NOTF-03
**Success Criteria** (what must be TRUE):
  1. User can sign up and log in using a phone number — OTP is delivered via SMS, verified, and a session is issued that persists across browser refreshes
  2. A user with multiple roles (e.g., Planner who is also a Supplier) can hold both roles on one phone number and access role-specific areas without conflict
  3. Admin can assign, change, or revoke a user's role through the admin panel
  4. OTP is rate-limited: after 5 failed attempts in one hour the phone is blocked, and a new OTP cannot be requested until the window resets
  5. Customer phone number is never visible to any vendor until the customer has given explicit consent and the contact reveal event is logged in the audit trail
**Plans**: TBD

Plans:
- [ ] 01-01: Monorepo scaffolding, Docker Compose, CI/CD pipeline, Prisma schema (users, user_roles, markets, consent_logs, webhook_events)
- [ ] 01-02: OTP auth — MSG91 integration, rate limiting, JWT session, Auth.js v5, multi-role guard middleware
- [ ] 01-03: Privacy infrastructure — consent tracking, contact masking logic, GDPR-style audit log, TRAI DLT SMS template registration

---

### Phase 2: Vendor Onboarding and Subscriptions
**Goal**: Vendors can create profiles, upload portfolio photos, select a subscription plan with Razorpay billing, and await admin KYC approval before receiving any leads
**Depends on**: Phase 1
**Requirements**: VEND-01, VEND-02, SUBS-01, SUBS-02, SUBS-03, ADMIN-01, ADMIN-02, ADMIN-04, ADMIN-06, NOTF-04
**Success Criteria** (what must be TRUE):
  1. Vendor can complete a business profile (name, categories, service cities with map UI, pricing, portfolio photos tagged by event type) and submit for KYC approval
  2. Admin receives an alert when a KYC submission arrives and can approve or reject the vendor from the admin panel; rejected vendors see the reason
  3. Vendor can select a subscription plan (Basic or Premium, for Planner or Supplier tier) and complete recurring billing via Razorpay — subscription auto-renews without manual action
  4. Admin can add, edit, or disable event categories and service types that appear across the platform
  5. Admin can manage subscription plan definitions and pricing from the admin panel without a code deploy
**Plans**: 3 plans

Plans:
- [ ] 02-01: Vendor profile creation flow — business details, service area (lat/lng + radius, PostGIS-ready), portfolio gallery (Cloudinary), progressive onboarding gate
- [ ] 02-02: Subscription billing — Razorpay Subscriptions integration, plan tiers (Planner Basic/Premium, Supplier Basic/Premium), auto-renewal, transactions ledger with SUBSCRIPTION type
- [ ] 02-03: Admin panel foundation — user management (view/edit/suspend all roles), KYC approval queue with NOTF-04 alerts, event category management, subscription plan management

---

### Phase 3: Lead Routing Engine
**Goal**: A customer can browse the platform, submit an event inquiry with explicit consent, and immediately receive a shortlist of the Top 3 matched vendors while routing happens asynchronously in the background
**Depends on**: Phase 2
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, LEAD-06, CUST-01, CUST-02, CUST-03, CUST-04, CUST-05, CUST-06, NOTF-01
**Success Criteria** (what must be TRUE):
  1. Customer can browse event categories, search and filter vendors by event type, city, and budget range, and view a vendor's full profile with portfolio, ratings, and service details
  2. Customer can submit an event inquiry form (event type, date, city, budget, guest count) — the lead is only created after the customer clicks an explicit consent checkbox
  3. Customer receives an immediate acknowledgment and a Top 3 vendor shortlist within seconds; the underlying routing job runs asynchronously without blocking the response
  4. The routing engine scores vendors using the weighted formula (Subscription Tier 30%, Rating 20%, Response Rate 20%, Location Match 20%, Fairness Rotation 10%) with vendor score factors pre-cached in Redis for sub-10ms routing
  5. Mode A routing (direct profile visit) sends the lead to that single vendor; Mode B routing (category/general inquiry) sends to Top 3 — both trigger Firebase push notifications to assigned vendors
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Schema additions (Lead, LeadAssignment, VendorStats, DeviceToken, PostGIS extension) + public customer browsing API (categories, vendor search/filter, vendor profile)
- [ ] 03-02-PLAN.md — Lead creation with consent gate, ScoringService (weighted formula), Redis score cache, PostGIS distance matching
- [ ] 03-03-PLAN.md — BullMQ async routing (Mode A/B), fairness rotation cap, Top 3 assignment, Firebase FCM push notifications, device token registration

---

### Phase 4: Vendor CRM and Booking Flow
**Goal**: Vendors can work their lead inbox, submit customized quotes, manage booking calendars, and close bookings; customers can compare quotes, accept one, track status, and leave a verified review after completion
**Depends on**: Phase 3
**Requirements**: VEND-03, VEND-04, VEND-05, VEND-06, VEND-07, VEND-08, CUST-07, CUST-08, CUST-09, CUST-10, NOTF-02
**Success Criteria** (what must be TRUE):
  1. Vendor receives new leads in a real-time inbox (Socket.IO) and can accept or decline each lead with a reason; vendor phone number remains masked until they accept
  2. Vendor can submit a customized quote with line items, total price, and validity period; customer can view and compare all quotes received for their inquiry
  3. Customer can accept one quote, which confirms the booking and transitions the status from Quoted to Booked — both parties see the updated status
  4. Booking status progresses through observable stages (Inquiry > Quotes Received > Booked > Completed) with push notifications to the customer at each transition
  5. After a booking is marked Completed, the customer can leave a verified review; the vendor can respond to the review publicly; unverified reviews from non-bookers are not accepted
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Vendor lead inbox: Socket.IO InboxGateway (JWT middleware in afterInit), accept/decline with contact reveal gate, all Phase 4 Prisma schema additions, IoAdapter in main.ts
- [ ] 04-02-PLAN.md — Quote builder: DRAFT→SUBMITTED state machine, BullMQ quote expiry, customer comparison view, quote acceptance → Booking creation in $transaction
- [ ] 04-03-PLAN.md — Booking status pipeline (BOOKED→IN_PROGRESS→COMPLETED), customer push notifications (NOTF-02), verified reviews, vendor response, vendor earnings dashboard, RoutingService wired to InboxGateway

---

### Phase 5: Payments and Commission Settlement
**Goal**: Customer payments flow through Razorpay, the platform captures commission automatically, vendor payouts are disbursed after deduction, and all four revenue streams are recorded in an isolated transactions ledger
**Depends on**: Phase 4
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, SUBS-04, SUBS-05, ADMIN-07
**Success Criteria** (what must be TRUE):
  1. Customer can pay for a confirmed booking via Razorpay (UPI, card, netbanking) from the booking detail page
  2. Platform commission (5-10% rate from rate table, not hardcoded) is calculated and split automatically at payment capture; vendor receives net payout via Razorpay Payouts
  3. Duplicate webhook events are detected and rejected using a unique constraint on (payment_id, event_type) — the same payment is never processed twice
  4. Admin can view the full payment log filterable by date, vendor, and transaction type, and can initiate refunds for disputed bookings
  5. All revenue transactions are recorded in a typed ledger (SUBSCRIPTION, LEAD_PURCHASE, BOOKING_COMMISSION, MARKETPLACE_SALE) enabling per-stream revenue reporting
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — Schema evolution (CommissionRate, Transaction generalization, Booking payment fields, VendorProfile bank details), CommissionService with specificity cascade, PaymentService with Razorpay Orders API, client payment verification
- [ ] 05-02-PLAN.md — Payment webhook at /webhooks/razorpay/payment with idempotency, BullMQ payment processor (commission split + Transaction creation), PayoutService (RazorpayX Composite Payout API with dev mock), payout triggered on booking COMPLETED
- [ ] 05-03-PLAN.md — Admin payment log with date/vendor/type filters, refund initiation via Razorpay SDK, revenue reconciliation by stream, commission rate CRUD for admin

---

### Phase 6: B2B Product Marketplace
**Goal**: Suppliers can list and manage their product catalog with inventory tracking; planners can browse, order, and track B2B product procurement through the platform
**Depends on**: Phase 5
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05
**Success Criteria** (what must be TRUE):
  1. Supplier can list a product with name, category, price, images (Cloudinary), and stock count; stock decrements on confirmed orders and a low-stock alert fires when threshold is crossed
  2. Planner can browse and search the supplier product catalog filtered by category and price, and view product details including fulfillment source (Zevento vs. supplier)
  3. Planner can place a B2B order and complete payment through the platform — the order appears in the supplier's management view immediately
  4. Supplier can update order status through the full lifecycle (Pending > Confirmed > Dispatched > Delivered) — planner sees current status without leaving the platform
**Plans**: TBD

Plans:
- [ ] 06-01: Supplier product management — product listing form, Cloudinary image upload, inventory tracking, low-stock alerts, stock reservation logic
- [ ] 06-02: Planner-facing catalog and ordering — product browse/search, order placement, Razorpay checkout, MARKETPLACE_SALE transaction type
- [ ] 06-03: Order lifecycle management — supplier order dashboard, status transitions (Pending > Confirmed > Dispatched > Delivered), planner order tracking view

---

### Phase 7: Analytics and Admin Hardening
**Goal**: Admins have full visibility into platform health and lead flow; the platform is instrumented for expansion beyond Surat and Ahmedabad with market density gates and routing override controls
**Depends on**: Phase 6
**Requirements**: ADMIN-03, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. Admin can view a live analytics dashboard showing leads per city, conversion rates (inquiry to booking), total revenue by stream, and active vendor count — data reflects activity from the previous 24 hours
  2. Admin can inspect the full lead routing log for any lead — see which vendors were scored, what scores they received, which three were assigned, and why — and can manually override the routing for a specific lead
**Plans**: TBD

Plans:
- [ ] 07-01: Admin analytics dashboard — leads/city, conversion funnel, revenue by stream (SUBSCRIPTION/LEAD_PURCHASE/BOOKING_COMMISSION/MARKETPLACE_SALE), active vendor metrics; read-optimized queries (materialized views or read replica)
- [ ] 07-02: Lead routing audit log and manual override — per-lead scoring trace view, admin override UI, market status management (Surat/Ahmedabad active; future city gates)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-05 |
| 2. Vendor Onboarding and Subscriptions | 3/3 | Complete | 2026-03-06 |
| 3. Lead Routing Engine | 3/3 | Complete | 2026-03-07 |
| 4. Vendor CRM and Booking Flow | 3/3 | Complete | 2026-03-08 |
| 5. Payments and Commission Settlement | 3/3 | Complete | 2026-03-13 |
| 6. B2B Product Marketplace | 0/3 | Not started | - |
| 7. Analytics and Admin Hardening | 0/2 | Not started | - |
