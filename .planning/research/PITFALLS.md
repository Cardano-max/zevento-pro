# Pitfalls Research

**Domain:** Multi-sided event marketplace — lead generation, vendor management, B2B product marketplace, booking, Indian payment gateways
**Project:** Zevento Pro (Surat + Ahmedabad, pan-India expansion)
**Researched:** 2026-03-04
**Confidence:** MEDIUM (training data up to Aug 2025; WebSearch/WebFetch unavailable; patterns cross-verified across marketplace, payment, and SaaS sub-domains from training corpus)

---

## Critical Pitfalls

### Pitfall 1: Solving the Cold-Start Problem on the Wrong Side

**What goes wrong:**
The platform launches with vendor onboarding before demand exists (or vice versa), causing vendors to receive zero leads and churn before the flywheel starts. Because Zevento has three sides — event seekers, planners/decorators, and product suppliers — the order in which sides are seeded matters critically. Seeding all three simultaneously with thin supply on each guarantees nobody gets value.

**Why it happens:**
Founders naturally start with supply because they can control it (they often know vendors). Demand creation requires marketing spend and feels less "productive." The instinct is to build the product for vendors first.

**How to avoid:**
Seed demand first via Google/Meta ads targeting event searchers in Surat + Ahmedabad. Use Kiwi Party / Birthday Kart's existing customer base as captive early demand. Only then open vendor onboarding — give each early vendor a guaranteed minimum lead flow (even if subsidised manually) so they stay engaged. Delay product supplier marketplace until planner/seeker liquidity exists.

**Warning signs:**
- Vendors signed up but lead count per vendor per month is below 3 after 60 days
- Vendor-side churn rate > 20% in first 90 days
- Support tickets saying "I haven't received any enquiries"

**Phase to address:**
Phase 1 (Foundation + supply seeding). Establish demand pipeline before vendor portal goes live.

---

### Pitfall 2: Lead Routing Algorithm That Ignores Geographic Precision

**What goes wrong:**
The lead scoring and routing engine uses city-level matching (Surat, Ahmedabad) and misses the intra-city distance problem. A vendor in South Surat gets routed leads for North Surat events 35 km away. Vendors reject leads or stop paying, citing irrelevance. Conversely, a simplistic algorithm routes every lead to the top-scoring vendor, starving mid-tier vendors and creating a "rich get richer" dynamic that destroys supply diversity.

**Why it happens:**
Geospatial queries are harder to implement than string matching. Developers default to `city = 'Surat'` filters. The scoring algorithm optimizes for conversion (send lead to best vendor) without a diversity constraint.

**How to avoid:**
- Store vendor service radius as a polygon or lat/lng + radius (km) from onboarding. Never use city-name strings as the join key.
- Use PostGIS `ST_DWithin` or equivalent for all lead-to-vendor matching. Index on geography columns from day 1.
- Add a diversity cap: no single vendor receives more than 40% of leads in a category per week. Below that cap, route by score; above it, route to next-best vendor.
- Expose vendor service area as a map UI during onboarding, not a text field.

**Warning signs:**
- Lead rejection rate > 30% (vendors saying "too far" or "not my area")
- One or two vendors dominating lead purchase stats
- Vendor complaints about lead quality despite high volume

**Phase to address:**
Phase 2 (Lead routing engine). Must be schema-correct from the first migration — retrofitting geography columns after data exists is expensive.

---

### Pitfall 3: Multi-Role Auth That Conflates Identity with Role

**What goes wrong:**
A user who is both an event planner and a product supplier ends up with two separate accounts because the auth system ties roles to accounts rather than to sessions/permissions. This happens in Indian markets where vendor-side hustle is common — one person runs a decor business and also sells balloon supplies. Alternatively, an admin at an event planning company needs a planner account, but the system has no concept of "member of organisation X with role Y."

**Why it happens:**
The initial auth model is built for the simplest case: one user = one role. OTP login is role-neutral, but the role is assigned at registration time and stored on the user row. Changing roles later requires a support ticket or a manual DB update.

**How to avoid:**
Model roles as a many-to-many between users and roles from day 1: `user_roles(user_id, role, context_id)`. On login, prompt role-selection if the user has multiple roles ("Login as planner / Login as supplier"). Store the active role in JWT claims or session, not in the user table. Never store `role` as a column on `users`.

**Warning signs:**
- Support requests asking "how do I switch between my planner and supplier accounts"
- Duplicate user records for the same phone number
- Admin panel showing "ghost" users (same contact, different IDs)

**Phase to address:**
Phase 1 (Auth foundation). This cannot be retrofitted without a full auth migration. The schema decision must be made before the first user is created.

---

### Pitfall 4: Revenue Model Complexity Without Isolation

**What goes wrong:**
Zevento has four revenue streams: subscriptions (vendors), lead sales (per-lead purchase), commissions (on bookings), and marketplace margins (product supplier). If these are not isolated in the billing/payment layer, a single Razorpay webhook fires and the code tries to determine which revenue stream it belongs to by inspecting metadata fields — leading to billing bugs, double-charges, and incorrect commission calculations that are nearly impossible to audit.

**Why it happens:**
Revenue streams are added incrementally. Each starts as a quick integration. Over time, webhook handlers grow into a giant `if/elif` tree. No single source of truth for what a "payment" means in each context.

**How to avoid:**
Design a `transactions` table with a `transaction_type` enum (SUBSCRIPTION, LEAD_PURCHASE, BOOKING_COMMISSION, MARKETPLACE_SALE) from day 1. Each Razorpay order created must carry this type in the `notes` field. Webhook handlers route to isolated processing functions per type. Commissions are calculated in a separate ledger table, not derived from payment amounts on the fly.

**Warning signs:**
- Webhook handler function longer than 150 lines
- Revenue reconciliation spreadsheet maintained separately from the app
- Vendor disputes about wrong billing that require manual DB queries to investigate

**Phase to address:**
Phase 2 (Payments + billing). The transaction ledger schema must be defined before the first payment is processed.

---

### Pitfall 5: Razorpay Webhook Idempotency Failures

**What goes wrong:**
Razorpay delivers webhooks at least once — they retry on failure. If the webhook handler is not idempotent, a payment captured event processed twice causes a double credit, a double commission, or (worst) a double lead-dispatch. In practice, retries happen frequently when the server is under load or briefly unavailable during deployment.

**Why it happens:**
Developers process webhooks synchronously within the HTTP handler. If processing takes more than a few seconds, Razorpay's timeout fires and it retries. The handler has no idempotency key check.

**How to avoid:**
- On webhook receipt: immediately store the `razorpay_payment_id` in a `webhook_events` table with status RECEIVED. Return HTTP 200 immediately.
- Enqueue actual processing to a background job queue (BullMQ on Redis or equivalent).
- Before processing, check if `payment_id` already exists with status PROCESSED. If yes, skip and return success.
- Use database unique constraints on `(payment_id, event_type)` as a hard idempotency guard.

**Warning signs:**
- Duplicate entries in the `leads_purchased` or `commissions` tables
- Vendor wallets/credits showing double amounts
- Webhook delivery logs in Razorpay dashboard showing retries

**Phase to address:**
Phase 2 (Payments). Must be implemented before going live with any payment flow. The job queue infrastructure should be provisioned alongside the payment integration.

---

### Pitfall 6: Onboarding Friction That Kills Supply Quality

**What goes wrong:**
Vendor onboarding asks for too much information upfront (GST certificate, portfolio photos, bank account, service area, categories, pricing tiers, availability calendar — all in one form). Vendors drop out mid-way. Those who complete have low-quality profiles because they rushed through it. Alternatively, the onboarding asks for too little, and vendors go live with no photos, no pricing, and no service area — making them un-matchable.

**Why it happens:**
Product managers list all required data and put it in a single form to "keep it simple." There is no progressive disclosure strategy.

**How to avoid:**
Gate vendor activation on a minimum viable profile: phone, city, primary category, one photo, and service radius. Let them go live in "pending approval" state. Use a profile completeness score (0–100%) displayed on the vendor dashboard that unlocks features as they complete sections. Require bank account details only when the first payout is triggered.

**Warning signs:**
- Vendor registration funnel completion rate below 40%
- Many vendor accounts with empty portfolio sections
- Vendors calling support to ask "what happens next after signing up"

**Phase to address:**
Phase 2 (Vendor portal). Design the onboarding flow with progressive disclosure from the first UI sprint.

---

### Pitfall 7: Scaling from City to National Without City-Specific Lead Pools

**What goes wrong:**
When Zevento expands from Surat + Ahmedabad to more cities (Mumbai, Pune, Delhi), the routing engine draws from a single national lead pool with city as a filter tag. Lead volumes in new cities are low, vendor density is low, and match quality collapses. Vendors in mature cities (Surat) start receiving leads from new cities because the algorithm finds no local match and falls back to proximity.

**Why it happens:**
The data model treats `city` as a tag rather than as a first-class entity. There is no city-level inventory concept, so the system cannot enforce "city isolation" during a market's cold-start phase.

**How to avoid:**
Model cities as separate markets: `markets(id, city, state, launch_date, status)`. Each lead belongs to a market. Each vendor serves one or more markets. During market cold-start (< 50 active vendors), manually curated matching is acceptable (operations team) — do not expose algorithmic routing until supply density makes it meaningful. Gate algorithmic routing on minimum vendor density per category per market.

**Warning signs:**
- Lead match rate below 60% in newly launched city
- Vendors in mature cities receiving leads from other cities
- Operations team manually reassigning leads frequently

**Phase to address:**
Phase 3 (Expansion). Market model should be built into the schema at Phase 1 even if only two cities are active — adding it later requires data migration.

---

### Pitfall 8: Commission Leakage When Bookings Go Offline

**What goes wrong:**
Event seekers contact vendors through Zevento, like what they see, and then complete the booking directly via WhatsApp or phone to avoid the platform fee. Zevento loses commission revenue. This is especially common in Indian markets where WhatsApp is the default communication channel and "calling the vendor directly" is culturally normal.

**Why it happens:**
The platform exposes vendor contact details too early in the discovery flow. Once a seeker has the vendor's phone number, there is no incentive to use the in-platform booking flow.

**How to avoid:**
- Mask vendor contact details behind a lead-purchase or booking-intent action. Reveal phone number only after the seeker has logged an "interest" event that is tracked.
- Build a lightweight messaging/inquiry system within Zevento so initial communication stays on-platform.
- For the product marketplace (Kiwi Party / Birthday Kart integration), enforce order creation through Zevento for all products to prevent direct supplier contact.
- Track "contact revealed" events vs. "booking created" events; a large gap is the signal.

**Warning signs:**
- Lead-to-booking conversion rate below 10% when contact details are shown
- Vendor reports of clients they met through Zevento but never saw a platform booking for
- Low repeat usage by event seekers despite reported satisfaction

**Phase to address:**
Phase 2 (Booking flow). Contact masking must be a design decision made before the vendor profile goes live.

---

### Pitfall 9: OTP Auth Without Rate Limiting and Fraud Prevention

**What goes wrong:**
The OTP system becomes a vector for SMS fraud and cost abuse. Attackers submit thousands of OTP requests to random phone numbers (or to a single phone for DoS), burning through the SMS budget (Twilio/AWS SNS/MSG91 costs are per-message). In India, fraudsters also register fake vendor accounts with disposable SIMs to harvest leads without paying.

**Why it happens:**
OTP flows are shipped with the happy path only. Rate limiting is added later "when needed." Account verification (vendor legitimacy) is deferred because it creates friction.

**How to avoid:**
- Rate limit OTP requests: max 3 OTPs per phone per 10-minute window, max 10 per phone per day. Block IP after 20 OTP attempts in 5 minutes.
- Store OTPs hashed in the database (bcrypt or SHA-256). Expire them after 5 minutes and invalidate after first use.
- For vendor accounts: require GST number verification (GSTIN API is free via the government portal) or at minimum a selfie-with-ID upload before the account can receive paid leads.
- Implement honeypot fields on OTP request forms to catch bots.

**Warning signs:**
- SMS costs spike without corresponding new user growth
- Multiple vendor accounts with overlapping phone numbers or GST numbers
- OTP request logs showing sequential phone number patterns

**Phase to address:**
Phase 1 (Auth). Rate limiting must ship with the OTP feature. Vendor verification can be Phase 2 but the infrastructure (ID upload, admin review queue) should be planned from the start.

---

### Pitfall 10: Product Marketplace Without Inventory Sync from Kiwi Party / Birthday Kart

**What goes wrong:**
Zevento lists products from the founder's existing supply chain (Kiwi Party, Birthday Kart) but the inventory is managed in a separate system (likely a spreadsheet, Shopify, or a legacy system). When a product is ordered through Zevento, there is no real-time stock check. Customers place orders for out-of-stock items. Fulfillment failures destroy trust early when the platform can least afford it.

**Why it happens:**
The integration is deferred ("we'll sync inventory later"). The initial approach is manual listing on Zevento with periodic CSV uploads. Volume grows before the sync is built.

**How to avoid:**
Define the integration contract (API or webhook) with the existing supply chain system before launching the product marketplace. If Kiwi Party / Birthday Kart runs on Shopify, use Shopify's inventory webhook (`inventory_levels/update`) to keep Zevento stock counts current. If it's a spreadsheet, invest 2 weeks in an integration layer (Google Sheets → webhook → Zevento) before launch. Never show "In Stock" without a live check.

**Warning signs:**
- Customer support tickets about "item ordered but not available"
- Manual order cancellation rate above 5%
- Vendors/suppliers sending inventory correction emails to the ops team

**Phase to address:**
Phase 3 (Product marketplace). Inventory sync contract must be defined in the architecture phase before marketplace development begins.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store vendor role as `users.role = 'vendor'` column | Simpler auth queries | Cannot support multi-role users; full migration required | Never — use role table from day 1 |
| City stored as string field (`city = 'Surat'`) | Easy to implement | Cannot do geospatial queries; no market model | Never — use `markets` table + lat/lng |
| Sync Razorpay webhook processing in HTTP handler | No queue setup needed | Double-processing on retries; timeouts cause failures | Never for production payments |
| Expose vendor phone in profile without masking | Simpler profile UI | Commission leakage via off-platform bookings | MVP phase only with manual tracking |
| Single lead score (one global model) | Faster to ship | Ignores category-specific conversion signals | Acceptable at < 500 vendors; replace by Phase 3 |
| No minimum vendor density gate for algorithmic routing | Routing works from day 1 | Poor match quality in thin markets destroys trust | Never — use manual ops matching below threshold |
| Hardcode GST at 18% on all transactions | Avoids tax complexity | GST rates vary by category; incorrect filings | MVP only if all products are same category |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Razorpay Payments | Trusting `payment_status` in the order API response instead of verifying via webhook | Always verify payment via webhook signature + server-side order fetch before crediting |
| Razorpay | Missing `razorpay_signature` HMAC verification on the frontend callback | Verify signature server-side using `razorpay_order_id + "\|" + razorpay_payment_id` hashed with webhook secret |
| Razorpay Payouts (vendor payouts) | Using Razorpay Payouts without completing RBI-mandated KYC for the marketplace account | Apply for PG + Payout account with full KYC documentation before building payout flows; approval takes 2-4 weeks |
| MSG91 / AWS SNS (OTP SMS) | No DLT (Distributed Ledger Technology) registration for SMS templates | TRAI mandates DLT registration for all transactional SMS in India; unregistered templates are blocked by operators |
| GSTIN Verification API | Assuming the government GSTIN lookup API has SLA guarantees | The API has no official uptime SLA; cache responses for 24 hours and have a fallback to manual review |
| Firebase / OTP providers | Not setting OTP expiry server-side (relying only on client-side countdown) | Server must expire OTP after N minutes regardless of client state |
| Google Maps / Mapbox | Using display-only maps for vendor service area definition | Use a drawing/polygon tool that stores coordinates, not just a pin; service area is a radius or polygon, not a city name |
| WhatsApp Business API | Sending booking confirmations via WhatsApp without pre-approved templates | WhatsApp Business API requires template pre-approval for all outbound messages; build this buffer into timeline |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 query on lead listing (fetching vendor profile for each lead separately) | Vendor dashboard loads slowly at > 50 leads | Eager-load vendor, category, and location data in a single JOIN | > 200 concurrent vendor dashboard loads |
| No database index on `leads(category_id, market_id, created_at)` | Lead routing queries take seconds, not milliseconds | Add composite index on routing query columns from first migration | > 10,000 leads in the table |
| Geospatial queries without PostGIS spatial index (GIST) | Vendor radius matching scans full table | Add `CREATE INDEX USING GIST` on geography columns | > 5,000 vendor records |
| Synchronous lead scoring on request (blocking the API response) | Lead submission form feels slow | Score leads asynchronously via background job; return "processing" state immediately | > 50 concurrent lead submissions |
| Razorpay order status polled from frontend every 2 seconds | Razorpay API rate limit hit; payment status delays | Use webhook for payment confirmation; show a "pending" state until webhook fires | > 100 concurrent checkouts |
| Session-based auth with in-memory store (no Redis) | Sessions lost on server restart; users logged out after deploy | Use Redis-backed sessions or stateless JWT from day 1 | First production deployment |
| Storing uploaded vendor portfolio images in local filesystem | Files lost on server restart/redeploy in containerised environments | Use S3-compatible object storage (AWS S3 or Cloudflare R2) from day 1 | First container restart |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Allowing event seekers to access other seekers' enquiry data via IDOR (insecure direct object reference on `/api/leads/:id`) | Data breach; vendor contact leakage | Enforce row-level ownership checks on every lead query: `WHERE id = :id AND user_id = :current_user` |
| Exposing vendor bank account details in the vendor profile API response | Financial data breach | Never return bank account numbers via API; mask to last 4 digits in all responses |
| Trusting client-sent `amount` in payment initiation | Customers pay ₹1 for ₹10,000 services | Always compute order amount server-side from the database record; never accept amount from request body |
| Webhook endpoint without signature verification | Forged payment confirmations; fake lead credits | Verify Razorpay `X-Razorpay-Signature` HMAC-SHA256 before processing every webhook |
| Multi-role JWT that doesn't encode the active role | Planner-role user accesses vendor-only admin pages | Include `active_role` in JWT claims; validate role claim on every protected route server-side |
| Storing raw OTPs in the database | OTP harvest if DB is compromised | Store OTPs as bcrypt hash or SHA-256; compare at verification time |
| No rate limit on the lead submission form | Spam leads that pollute vendor feed and trigger false SMS alerts | Rate limit by IP and by authenticated user: max 5 lead submissions per user per hour |
| Admin panel accessible without IP allowlist | Admin takeover if credentials leaked | Restrict admin panel to VPN/IP allowlist at infrastructure level, not just application auth |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Vendor dashboard shows raw lead data with no context (just name + phone) | Vendors can't prioritise; call everyone | Show lead quality score, event date, budget range, and category inline; let vendor sort by score |
| Event seeker submits enquiry and sees nothing for days | Churn; they go to JustDial or UrbanClap | Send automated "Your enquiry is being matched" SMS within 2 minutes; follow up with match result within 4 hours |
| Vendor receives 10 leads simultaneously with no prioritisation signal | Cognitive overload; worst leads get called first | Surface top 3 leads prominently; show estimated response value (budget × commission rate) |
| No-show notifications for booked events | Vendor turns up; client forgot | Send reminder SMS/WhatsApp to both parties 48h and 2h before event |
| Subscription renewal happens silently; vendor discovers expiry when they stop getting leads | Vendor frustration; churn | Send renewal reminders 14 days, 7 days, 3 days, and 1 day before expiry; show countdown in dashboard |
| Product marketplace mixes Kiwi Party / Birthday Kart items with third-party supplier items without clear provenance | Trust confusion; returns go to wrong entity | Label items clearly: "Fulfilled by Zevento" vs. "Fulfilled by [Supplier Name]"; separate return policies |
| OTP-only auth with no "remember this device" option | Vendors must OTP every session on mobile | Offer "remember for 30 days" on vendor mobile app; use refresh token with long TTL |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Lead routing:** Routing sends leads to vendors — verify the vendor's service radius actually covers the event location (not just the same city string) before calling it done
- [ ] **Payment integration:** Checkout works — verify idempotency (submit same order twice), webhook retry handling, and failed payment recovery flow before marking complete
- [ ] **Vendor onboarding:** Registration form submits — verify that an admin review step exists, that incomplete profiles are blocked from receiving leads, and that the vendor receives an activation confirmation SMS
- [ ] **OTP auth:** OTP is sent and verified — verify rate limiting is enforced, OTPs expire after 5 minutes, and used OTPs cannot be replayed
- [ ] **Subscription billing:** Payment is collected — verify that subscription expiry correctly blocks lead delivery, that renewal works end-to-end, and that failed renewals trigger a grace period + retry flow
- [ ] **Commission calculation:** Commission is computed on booking — verify that the commission rate is pulled from the rate table at booking time (not hardcoded), and that the vendor's net payout is correct after Razorpay fee deduction
- [ ] **Geospatial matching:** Vendors appear in search results — verify that a vendor with a 20 km radius centred in South Surat does NOT appear in results for an event 25 km away
- [ ] **Multi-role auth:** User can log in as planner — verify that the same phone number can be associated with a planner role AND a supplier role, and that switching between them does not expose the other role's data

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Single-role schema shipped to production | HIGH | Migrate `users.role` → `user_roles` table; write one-time migration script; update all auth middleware; regression test every protected route |
| City-string geography shipped to production | HIGH | Add `market_id` FK to all tables; back-fill from city strings; add PostGIS extension; add spatial indexes; update all routing queries |
| Webhook double-processing discovered after launch | MEDIUM | Add `webhook_events` idempotency table with unique constraint; replay affected events; reconcile billing ledger manually; compensate affected vendors |
| Commission leakage via off-platform bookings | MEDIUM | Implement contact masking retroactively; renegotiate with high-value vendors using offline-tracking incentive; add booking completion survey as lead-quality signal |
| OTP SMS cost explosion | LOW-MEDIUM | Add rate limiting middleware immediately; block flagged IPs via CloudFlare; audit recent OTP logs for abuse patterns; negotiate volume pricing with SMS provider |
| Poor lead quality in new city (no density) | MEDIUM | Pause algorithmic routing in that city; route manually via ops team; run targeted vendor acquisition campaign before re-enabling algorithm |
| Inventory sync failures causing oversell | MEDIUM | Implement inventory reservation (soft-hold on order placement, hard-deduct on payment); add reconciliation job; build admin cancel + refund flow |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cold-start wrong side first | Phase 1 | Demand pipeline active before vendor portal opens |
| Lead routing ignores geography | Phase 1 (schema) + Phase 2 (engine) | Lead rejection rate < 15% in first month; geospatial query plan shows index scan |
| Multi-role auth conflates identity with role | Phase 1 | `user_roles` table exists; same phone can hold two roles; role-switch UI tested |
| Revenue model not isolated in billing layer | Phase 2 | `transactions.transaction_type` enum covers all 4 streams; webhook routes to isolated handlers |
| Razorpay webhook not idempotent | Phase 2 | Submit same `payment_id` twice; verify second processing is skipped; check `webhook_events` table |
| Onboarding friction kills supply quality | Phase 2 | Vendor funnel completion rate > 60%; minimum viable profile gate enforced |
| Scaling city → national without market model | Phase 1 (schema) + Phase 3 (routing gate) | `markets` table exists at launch; city expansion requires market record creation |
| Commission leakage off-platform | Phase 2 | Contact masking in place before first vendor goes live; "contact revealed" event tracked |
| OTP without rate limiting | Phase 1 | Rate limit test: 4th OTP within 10 minutes returns 429; used OTP rejected on replay |
| Product marketplace without inventory sync | Phase 3 | Integration contract signed with Kiwi Party / Birthday Kart before marketplace sprint; live stock check demonstrated |
| DLT registration for SMS | Phase 1 | DLT registration submitted before first OTP SMS sent; confirmed delivery receipt |
| Razorpay Payout KYC | Phase 2 | Razorpay Payout account approved before payout feature is built; KYC application submitted in Phase 1 |

---

## Sources

- Training data: multi-sided marketplace architecture patterns (Airbnb, UrbanClap/Urban Company, Dunzo, Swiggy engineering blogs) — MEDIUM confidence
- Training data: Razorpay integration patterns and Indian payment gateway requirements — MEDIUM confidence; recommend verifying DLT registration requirements and Payout KYC timeline against current Razorpay docs before Phase 2
- Training data: TRAI DLT registration mandate for transactional SMS in India — MEDIUM confidence; verify current operator enforcement status
- Training data: PostGIS geospatial indexing for marketplace radius matching — HIGH confidence (well-documented, stable API)
- Training data: Multi-role RBAC patterns for B2B SaaS — HIGH confidence (established pattern)
- Training data: Webhook idempotency patterns (Stripe, Razorpay) — HIGH confidence (official guidance consistent across payment providers)
- Training data: Cold-start problem in marketplace platforms (research papers by Eisenmann, Parker, Van Alstyne) — HIGH confidence

**NOTE:** WebSearch and WebFetch were unavailable during this research session. All findings reflect training knowledge as of August 2025. Before Phase 1 development begins, verify:
1. Current Razorpay Payout KYC timelines and requirements (razorpay.com/docs)
2. DLT registration process and enforcement status (trai.gov.in)
3. GSTIN verification API availability and rate limits (taxpayerapi.gst.gov.in)

---
*Pitfalls research for: Multi-sided event marketplace (Zevento Pro)*
*Researched: 2026-03-04*
