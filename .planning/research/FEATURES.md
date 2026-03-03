# Feature Research

**Domain:** Multi-sided event marketplace (service booking + B2B product supply + lead generation)
**Researched:** 2026-03-04
**Confidence:** MEDIUM
**Confidence Note:** WebSearch and WebFetch unavailable in this session. All findings are from training data (cutoff August 2025) cross-referenced across Urban Company, IndiaMart, Thumbtack, WeddingWire, Sulekha, and comparable Indian B2B/B2C marketplace patterns. Marked per finding below.

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are non-negotiable. Missing any one of these causes a specific user type to abandon the platform before completing a transaction.

#### Customer-Facing (Event Seekers)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OTP-based phone auth | Indian users trust phone-number identity; email signup has very low conversion in India | LOW | WhatsApp OTP preferred over SMS; requires Twilio/MSG91/2Factor integration |
| Event inquiry / lead submission form | Core entry point — without this, there is no product | LOW | Must capture: event type, date, venue city, budget range, guest count |
| Top 3 vendor shortlist display | Customers expect a curated, ranked result not an overwhelming directory | MEDIUM | Drives the core scoring algorithm; must show profile, price range, rating, portfolio |
| Vendor profile with portfolio | Customers need visual proof before trusting a vendor with their event | MEDIUM | Photo gallery, past work, specializations, verified badge |
| Vendor reviews and ratings | Social proof is table stakes in any Indian service marketplace (Urban Company set the expectation) | MEDIUM | Aggregate star rating + text reviews; moderated for fraud |
| Basic messaging between customer and vendor | Customers need to ask clarifying questions before committing | MEDIUM | In-app chat preferred over exposing phone numbers pre-booking |
| Booking confirmation + status tracking | After placing a booking, customers expect visible progress (inquiry → confirmed → completed) | MEDIUM | Status timeline: Inquiry > Quotes > Booked > Completed |
| Push/SMS/WhatsApp booking notifications | Indian users expect real-time updates via WhatsApp, not just email | MEDIUM | WhatsApp Business API is table stakes in India 2025+ |
| Price transparency / quote request | Customers expect to see at minimum a price range; surprise pricing causes abandonment | LOW | Quote request flow, not fixed price display initially |
| Search / filter by event type, city, budget | Basic discoverability without scrolling through all vendors | MEDIUM | Filters: event type, location (Surat/Ahmedabad), budget range, service category |

#### Vendor/Planner-Facing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vendor onboarding / profile setup | Without a profile, vendors cannot receive leads | MEDIUM | Business name, service categories, coverage areas, pricing, photo upload |
| Lead inbox / lead notification | Core value proposition for paying vendors — they must see incoming leads immediately | LOW | Push notification + in-app inbox; missed leads = immediate churn |
| Lead acceptance / rejection | Vendors need to manage their capacity; cannot be force-assigned | LOW | Accept/decline with reason; deadline before lead re-routes |
| Quote submission to customer | Vendors send customized quotes for each inquiry | MEDIUM | Quote builder with line items, validity period, optional deposit requirement |
| Subscription plan selection | Revenue model requires vendors to choose a plan to access leads | MEDIUM | Plan tiers with lead credits or unlimited leads depending on plan |
| Booking calendar / availability | Vendors need to mark themselves unavailable on specific dates to avoid double-booking | MEDIUM | Calendar view, block dates, recurring unavailability |
| Payment receipt from customers | Vendors need to receive deposits or full payment through the platform | HIGH | Razorpay integration; split payment (platform commission + vendor payout) |
| Portfolio / gallery management | Vendors update their work samples to attract customers | LOW | Image upload, before/after, tags by event type |
| Review response | Vendors expect to respond to customer reviews publicly | LOW | Reply thread on each review |
| Basic earnings / lead spend dashboard | Vendors need to see ROI on subscription spend | MEDIUM | Leads received, leads won, earnings, lead credits remaining |

#### Supplier-Facing (Product Marketplace)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Product catalog management | Suppliers need to list their event inventory (tents, chairs, decor items, lighting) | MEDIUM | Product name, SKU, category, price, availability, images |
| Inventory tracking | Suppliers deal in rentable/perishable goods; stock management is critical | MEDIUM | Track units available, units booked per date, low-stock alerts |
| Order management | Suppliers receive and process product orders | MEDIUM | Order status: Pending → Confirmed → Dispatched → Delivered → Returned |
| Pricing and rental period management | Event items are often rented, not sold; pricing is per-day or per-event | MEDIUM | Rental pricing model with date-range selection |
| B2B product ordering by planners | Planners order from suppliers on behalf of their event customers | MEDIUM | The planner-to-supplier relationship is the key B2B channel |

#### Admin Panel

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User management (all 4 roles) | Admin must control every account type | MEDIUM | View, edit, suspend, verify users; KYC status |
| Lead management / routing oversight | Admin must see lead flow and intervene when routing fails | MEDIUM | Lead log, routing results, manual override |
| Vendor verification / KYC approval | Platform trust depends on verified vendors | MEDIUM | Document upload review, approval/rejection workflow |
| Subscription and payment management | Admin must handle billing disputes, plan changes, refunds | HIGH | Payment logs, invoice management, refund initiation |
| Platform analytics dashboard | Admin needs visibility into platform health | HIGH | Daily leads, conversions, revenue, active vendor count |
| Content / category management | Admin maintains event types, service categories, cities covered | LOW | CRUD for lookup data |
| Dispute resolution | Admin arbitrates between customer and vendor after bookings | MEDIUM | Dispute ticket system, evidence upload, admin verdict |

---

### Differentiators (Competitive Advantage)

These are where Zevento Pro competes. They are not universally expected but create switching costs and justify premium pricing.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Top 3 scoring algorithm with transparency | Vendors understand why they ranked where they did; motivates profile completion and subscription upgrades | HIGH | Score factors: subscription tier, rating, response rate, portfolio completeness, reviews, location match. Transparency builds vendor trust. MEDIUM confidence — verified pattern from Thumbtack, JustDial Pro |
| Lead credit system (pay-per-lead option) | Vendors who cannot commit to subscriptions buy individual lead credits; expands TAM beyond subscription-only | MEDIUM | Credit wallet, credit deduction per accepted lead, auto-recharge option |
| Vendor response rate tracking and scoring | Response rate affects vendor ranking; creates game mechanic that improves customer experience | MEDIUM | Vendors with low response rate drop in score; surfaced in vendor dashboard |
| WhatsApp-native notifications for all roles | Indian market is WhatsApp-first; email notifications are largely ignored by both customers and vendors | MEDIUM | WhatsApp Business API, not just SMS; two-way message handling for booking updates |
| Planner-to-supplier B2B procurement layer | Planners can order event supplies directly through the platform, creating a fully vertical stack | HIGH | Separate B2B checkout flow; net-30 credit terms for verified planners; supplier payout split |
| AI-assisted event brief from customer | Customer describes their event in natural language; system generates structured inquiry (event type, budget, guest count, style) | HIGH | GPT API integration; reduces form friction; improves lead quality for vendors. LOW confidence — emerging pattern not yet standard in Indian market |
| Vendor portfolio AI tagging | Uploaded photos are auto-tagged by decor style, color palette, event type; improves search relevance | HIGH | Vision API integration. LOW confidence — rare in Indian event market |
| Real-time vendor availability signal | Customers see "Available for your date" vs "Check availability" before shortlist generation; reduces friction | MEDIUM | Requires vendors to maintain calendar; availability check in routing algorithm |
| Milestone-based payment escrow | Customer pays into escrow; vendor receives payment in milestones (booking deposit → event completion); protects both sides | HIGH | Razorpay escrow or simulated escrow with manual release; builds platform trust significantly |
| Event inspiration gallery (curated content) | SEO-driving content; customers discover Zevento through event style browsing before they have a specific need | MEDIUM | Curated photo gallery by event type (wedding, corporate, birthday); links to vendor profiles |
| Vendor success score / profile strength meter | Gamified completeness indicator tells vendors exactly what to improve to rank higher; reduces churn | LOW | % completion bar with specific action items (add 5 photos, get 3 reviews, respond within 2 hrs) |
| City-specific lead surge notifications | When inquiry volume spikes in a city, notify vendors in that city to ensure capacity | LOW | Push notification: "10 new wedding inquiries in Surat this week — accept leads now" |

---

### Anti-Features (Commonly Requested, Often Problematic)

These seem like good ideas but consistently create more problems than value in the Indian multi-sided marketplace context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Open public vendor directory with direct contact | "More leads for vendors, more choice for customers" | Disintermediates the platform — customers call vendors directly, bypassing subscription revenue and commission. This is the core failure mode of JustDial. | Keep contact details hidden until a paid lead is generated or a booking is made. Show only name, rating, and portfolio publicly. |
| Real-time bidding / auction for every lead | "Let the market set the price" | Creates a race to the bottom on price; degrades vendor quality; exhausting for customers who must evaluate 10+ bids. Urban Company abandoned open bidding for curated matching. | Top 3 curated shortlist with fixed quote submission window. |
| Vendor chat before lead acceptance | "Vendors want to qualify the lead first" | Vendors use pre-acceptance chat to extract customer contact info and take transactions off-platform. | Lead preview summary (event type, date, budget range) before acceptance; full details only after acceptance. |
| Free tier for vendors with full lead access | "Lower barrier to entry" | Free vendors have no commitment; they ghost leads, kill customer experience, and devalue paid subscriptions. | Free trial with 2-3 leads maximum, then subscription required; OR lead-credit pay-per-lead with minimum purchase. |
| Customer-to-customer reviews on all vendors | "More transparency" | Easy to game; competitors leave negative reviews; fake positive reviews flood in. Seen extensively on JustDial. | Verified-only reviews: only customers who completed a booking can leave reviews. |
| Full social media feed / community forum | "Build community, increase engagement" | Massive scope expansion; requires content moderation team; pulls focus from core marketplace loop. LinkedIn for events is not the product. | Vendor inspiration gallery with SEO value; static testimonials. |
| Automated price negotiation chat bot | "Help customers get the best price" | Erodes vendor margins; vendors learn to quote high to leave negotiation room; degrades trust in platform pricing. | Transparent quote builder where vendors itemize costs; customers see what they're paying for. |
| Global or pan-India launch simultaneously | "Scale faster" | Operations, vendor verification, and lead quality require local density. Spreading thin across India kills quality in all cities. Urban Company spent years on city-by-city density before scaling. | Start Surat + Ahmedabad with deep density; add cities only when conversion rate and vendor NPS are stable. |
| Customer loyalty points / rewards program | "Retain customers" | Event frequency is inherently low (1-2 weddings in a lifetime, maybe annual corporate events). Loyalty programs don't change behavior in low-frequency categories. | Invest in referral bonuses instead — customers refer their network for a specific discount on next booking. |
| In-app event planning tools (seating charts, RSVP) | "Make it a full planning suite" | Deeply complex product; creates competition with dedicated tools like RSVPify, AllSeated. Distracts from marketplace core. | Integrate or recommend third-party tools; focus on the vendor-customer connection which is the core value. |

---

## Feature Dependencies

```
[OTP Auth]
    └──required by──> [Customer Inquiry Submission]
    └──required by──> [Vendor Profile Setup]
    └──required by──> [Admin Panel Login]

[Vendor Profile Setup]
    └──required by──> [Lead Routing Algorithm]
    └──required by──> [Portfolio Display]
    └──required by──> [Vendor Reviews]

[Customer Inquiry Submission]
    └──required by──> [Lead Routing Algorithm]

[Lead Routing Algorithm]
    └──required by──> [Top 3 Vendor Shortlist Display]
    └──required by──> [Lead Inbox (Vendor)]
    └──required by──> [Lead Acceptance / Rejection]

[Lead Acceptance / Rejection]
    └──required by──> [Quote Submission]
    └──required by──> [In-app Messaging]

[Quote Submission]
    └──required by──> [Booking Confirmation]

[Booking Confirmation]
    └──required by──> [Payment Collection]
    └──required by──> [Booking Calendar Update]
    └──required by──> [Verified Customer Review]

[Subscription Plan Selection]
    └──required by──> [Lead Credit Deduction]
    └──enhances──> [Lead Routing Algorithm] (subscription tier is a scoring factor)

[Payment Collection (Razorpay)]
    └──required by──> [Vendor Payout]
    └──required by──> [Platform Commission Capture]
    └──required by──> [Milestone Payment Escrow] (advanced)

[Product Catalog (Supplier)]
    └──required by──> [B2B Planner-to-Supplier Order]
    └──required by──> [Inventory Tracking]

[Vendor KYC / Verification (Admin)]
    └──enhances──> [Lead Routing Algorithm] (verified badge boosts score)
    └──required by──> [Verified Badge on Profile]

[Booking Calendar]
    └──enhances──> [Lead Routing Algorithm] (availability check before routing)
    └──required by──> [Real-time Availability Signal] (differentiator)
```

### Dependency Notes

- **Lead Routing Algorithm requires Vendor Profile Setup:** The scoring algorithm cannot rank vendors without profile completeness data, portfolio count, rating, and subscription tier. Vendor onboarding must be fully functional before customer inquiry flow goes live.
- **Verified Customer Review requires Booking Confirmation:** Reviews must be gated behind completed bookings to prevent fraud. The booking completion event triggers the review invitation.
- **Subscription Plan Selection enhances Lead Routing Algorithm:** Subscription tier is one of the primary scoring factors. A vendor on a higher plan appears higher in Top 3 shortlists when other factors are equal. This is the core monetization mechanic — vendors upgrade plans to rank higher.
- **B2B Planner-to-Supplier Order requires Product Catalog:** The supplier side of the marketplace cannot function until suppliers have created product listings with pricing and availability.
- **Payment Collection conflicts with Off-platform Payments:** If vendors accept payments outside the platform, commission capture fails. Platform must enforce and incentivize in-platform payment (e.g., escrow protection, payment receipts, dispute resolution only for in-platform transactions).

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate lead generation and vendor subscription revenue in Surat + Ahmedabad.

- [ ] OTP phone authentication (customer + vendor + admin roles) — identity foundation for everything
- [ ] Customer inquiry form (event type, date, city, budget, guest count) — the lead creation entry point
- [ ] Lead routing algorithm (Top 3 vendor shortlist based on subscription tier + rating + location + availability) — the core product promise
- [ ] Vendor profile with portfolio gallery and service categories — without this vendors cannot be evaluated
- [ ] Vendor lead inbox with push/WhatsApp notification — vendors must know about leads immediately
- [ ] Lead acceptance / quote submission flow — basic vendor-to-customer communication
- [ ] Vendor subscription plans (at least 2 tiers: Basic, Premium) with Razorpay payment — revenue foundation
- [ ] Booking confirmation and status tracking — closes the loop from inquiry to booking
- [ ] Basic vendor reviews (post-booking, verified only) — social proof for next customer
- [ ] Admin panel: user management, lead log, vendor KYC approval, basic revenue view — operator visibility
- [ ] WhatsApp/SMS notifications for lead alerts and booking status — India-market requirement

### Add After Validation (v1.x)

Features to add once lead volume and vendor subscription conversion are validated (target: 50+ active vendors, 20+ leads/week per city).

- [ ] Lead credit wallet (pay-per-lead alternative to subscription) — unlocks non-subscription vendors; add when subscription conversion rate stalls
- [ ] Booking calendar with vendor availability blocking — reduces routing mismatches; add when double-booking complaints appear
- [ ] Supplier product catalog and B2B ordering — activate when planners are active on platform and requesting supplies
- [ ] Vendor response rate tracking affecting lead score — add when response rate drops below 80%; needs data first
- [ ] In-app chat (replace email/WhatsApp for pre-booking communication) — add when lead volume is high enough that off-platform communication is causing churn
- [ ] Event inspiration gallery / SEO content pages — add when organic traffic acquisition becomes a priority
- [ ] Vendor success score / profile strength meter — add after initial onboarding friction is understood

### Future Consideration (v2+)

Defer until product-market fit is established in Surat + Ahmedabad and the platform is expanding to new cities.

- [ ] AI-assisted event brief from natural language input — powerful but requires GPT API costs to be justified by lead volume
- [ ] Milestone payment escrow — complex to implement; add when booking value per transaction exceeds Rs 50,000 regularly
- [ ] Multi-city expansion tooling (city admin roles, city-specific routing config) — defer until 2nd city goes live
- [ ] Vendor portfolio AI photo tagging — nice-to-have SEO and UX improvement; not revenue-impacting in early stage
- [ ] Real-time vendor availability signal in shortlist — requires high vendor calendar adoption first
- [ ] Corporate / B2B event package pricing — separate feature set; add when corporate customers are a meaningful segment

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| OTP Auth | HIGH | LOW | P1 |
| Customer Inquiry Form | HIGH | LOW | P1 |
| Lead Routing Algorithm (Top 3) | HIGH | HIGH | P1 |
| Vendor Profile + Portfolio | HIGH | MEDIUM | P1 |
| Vendor Lead Inbox + Notifications | HIGH | MEDIUM | P1 |
| Vendor Subscription + Razorpay | HIGH | MEDIUM | P1 |
| Quote Submission Flow | HIGH | MEDIUM | P1 |
| Booking Confirmation + Status | HIGH | MEDIUM | P1 |
| Verified Post-booking Reviews | HIGH | MEDIUM | P1 |
| Admin Panel (core) | HIGH | MEDIUM | P1 |
| WhatsApp Notifications | HIGH | MEDIUM | P1 |
| Lead Credit Wallet | MEDIUM | MEDIUM | P2 |
| Booking Calendar + Availability | MEDIUM | MEDIUM | P2 |
| In-app Messaging | MEDIUM | MEDIUM | P2 |
| Supplier Product Catalog | MEDIUM | HIGH | P2 |
| B2B Planner-to-Supplier Ordering | MEDIUM | HIGH | P2 |
| Vendor Response Rate Scoring | MEDIUM | LOW | P2 |
| Vendor Success Score Meter | LOW | LOW | P2 |
| Event Inspiration Gallery | MEDIUM | MEDIUM | P2 |
| AI Event Brief (NLP) | MEDIUM | HIGH | P3 |
| Milestone Payment Escrow | HIGH | HIGH | P3 |
| Vendor Portfolio AI Tagging | LOW | HIGH | P3 |
| Real-time Availability Signal | MEDIUM | HIGH | P3 |
| Multi-city Admin Tooling | HIGH | MEDIUM | P3 |

---

## Competitor Feature Analysis

| Feature | Urban Company (India) | WeddingWire / The Knot (US) | Sulekha (India) | Zevento Pro Approach |
|---------|----------------------|-----------------------------|-----------------|----------------------|
| Lead routing model | Curated match (3-5 pros) | Customer browses, contacts vendors | Lead blast to many vendors | Top 3 curated shortlist via scoring algorithm |
| Vendor discovery | Category + location search | Search + reviews directory | Directory listing | Inquiry-first: customer submits inquiry, vendors are routed to them |
| Vendor revenue model | Service commission | Subscription + lead fees | Subscription + featured listing | Subscription tier + lead credits + booking commission |
| Customer contact exposure | Hidden until booking confirmed | Public vendor directory | Vendor calls customer immediately | Hidden until lead accepted by vendor |
| Reviews | Verified (post-booking only) | Mix of verified and unverified | Easily gamed, largely unverified | Verified post-booking only |
| Payment handling | Full in-platform (Razorpay) | External (vendor handles payment) | External | In-platform Razorpay with commission split |
| B2B product supply | Not present | Not present | Not present | Supplier product marketplace for planners |
| WhatsApp integration | Yes (primary channel) | No | Limited | Primary notification and communication channel |
| AI-assisted matching | Yes (internal ML model) | Limited | No | Scoring algorithm v1, ML v2+ |
| Vendor verification | Mandatory KYC | Optional | Optional | Mandatory KYC with admin review |

---

## Sources

- Urban Company product experience and feature set — MEDIUM confidence (training data, observed patterns through August 2025)
- WeddingWire / The Knot marketplace model — MEDIUM confidence (training data, well-documented US market)
- Sulekha India marketplace model — MEDIUM confidence (training data, Indian market context)
- IndiaMart B2B marketplace patterns — MEDIUM confidence (training data, Indian B2B context)
- Thumbtack lead marketplace model — MEDIUM confidence (training data, US market, strong analog for lead-credit mechanics)
- JustDial failure patterns (disintermediation) — MEDIUM confidence (training data, widely discussed in Indian startup ecosystem)
- Razorpay payment integration patterns for Indian marketplaces — MEDIUM confidence (training data, official docs consulted in prior context)
- WhatsApp Business API adoption in Indian consumer apps — MEDIUM confidence (training data, industry-standard by 2025 in India)

**Verification flag:** All competitor feature claims should be validated against current product experiences before roadmap finalization. Urban Company and Sulekha features evolve rapidly.

---
*Feature research for: Multi-sided event marketplace (Zevento Pro)*
*Researched: 2026-03-04*
