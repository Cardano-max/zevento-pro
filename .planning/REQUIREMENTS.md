# Requirements: Zevento Pro

**Defined:** 2026-03-04
**Core Value:** Customers can discover and book event services while the platform intelligently routes qualified leads to the best-matched vendors, creating value for both sides of the marketplace.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up and log in using phone number with OTP verification
- [ ] **AUTH-02**: User session persists across browser refreshes
- [ ] **AUTH-03**: System supports multi-role identity (Customer, Planner, Supplier, Admin) with role-based access
- [ ] **AUTH-04**: Admin can manage user roles and access levels
- [ ] **AUTH-05**: OTP rate limiting prevents abuse (max 5 attempts per phone per hour)

### Customer Experience

- [ ] **CUST-01**: Customer can browse event categories (Birthday, Wedding, Corporate, Mehndi, etc.)
- [ ] **CUST-02**: Customer can search and filter vendors by event type, city, and budget range
- [ ] **CUST-03**: Customer can view vendor profile with portfolio gallery, ratings, and service details
- [ ] **CUST-04**: Customer can submit event inquiry form (event type, date, city, budget, guest count)
- [ ] **CUST-05**: Lead is created only after explicit customer consent
- [ ] **CUST-06**: Customer receives Top 3 vendor shortlist with profiles and price ranges
- [ ] **CUST-07**: Customer can view and compare quotes from matched vendors
- [ ] **CUST-08**: Customer can accept a quote and confirm booking
- [ ] **CUST-09**: Customer can track booking status (Inquiry > Quotes > Booked > Completed)
- [ ] **CUST-10**: Customer can leave verified review after booking completion

### Lead Routing Engine

- [ ] **LEAD-01**: System routes leads to Top 3 vendors based on scoring algorithm
- [ ] **LEAD-02**: Scoring considers: Subscription Tier (30%), Rating (20%), Response Rate (20%), Location Match (20%), Fairness Rotation (10%)
- [ ] **LEAD-03**: Mode A routing: direct to single vendor when customer visits specific profile
- [ ] **LEAD-04**: Mode B routing: Top 3 vendors for category/general inquiries (default)
- [ ] **LEAD-05**: Lead routing is async (customer gets immediate acknowledgment, routing happens in background)
- [ ] **LEAD-06**: Vendor scoring factors are cached for fast routing performance

### Vendor/Planner CRM

- [ ] **VEND-01**: Vendor can create business profile (name, categories, service cities, pricing, photos)
- [ ] **VEND-02**: Vendor can manage portfolio gallery (upload photos, tag by event type)
- [ ] **VEND-03**: Vendor receives leads in real-time inbox with push notifications
- [ ] **VEND-04**: Vendor can accept or decline leads with reason
- [ ] **VEND-05**: Vendor can submit customized quotes with line items and validity period
- [ ] **VEND-06**: Vendor can view booking calendar and block unavailable dates
- [ ] **VEND-07**: Vendor can view earnings dashboard (leads received, leads won, earnings, ROI)
- [ ] **VEND-08**: Vendor can respond to customer reviews publicly

### Subscription & Monetization

- [ ] **SUBS-01**: Platform offers tiered subscription plans (Basic, Premium) for planners
- [ ] **SUBS-02**: Platform offers tiered subscription plans for suppliers
- [ ] **SUBS-03**: Subscription billing via Razorpay with auto-renewal
- [ ] **SUBS-04**: Platform charges booking commission (5-10%) on confirmed bookings
- [ ] **SUBS-05**: Platform captures margin on B2B product sales

### Payments

- [ ] **PAY-01**: Customer can pay for bookings via Razorpay (UPI, cards, netbanking)
- [ ] **PAY-02**: Platform processes commission split automatically
- [ ] **PAY-03**: Vendor receives payout after commission deduction
- [ ] **PAY-04**: Razorpay webhook processing with idempotency (no duplicate transactions)
- [ ] **PAY-05**: Admin can view payment logs and initiate refunds

### B2B Product Marketplace

- [ ] **PROD-01**: Supplier can list products with name, category, price, images, and stock
- [ ] **PROD-02**: Supplier can manage inventory with stock tracking and low-stock alerts
- [ ] **PROD-03**: Planner can browse and search supplier product catalog
- [ ] **PROD-04**: Planner can place B2B orders from suppliers through the platform
- [ ] **PROD-05**: Supplier can manage order lifecycle (Pending > Confirmed > Dispatched > Delivered)

### Admin Panel

- [ ] **ADMIN-01**: Admin can view, edit, and suspend users across all roles
- [ ] **ADMIN-02**: Admin can review and approve/reject vendor KYC applications
- [ ] **ADMIN-03**: Admin can view lead flow, routing results, and manually override routing
- [ ] **ADMIN-04**: Admin can manage event categories and service types
- [ ] **ADMIN-05**: Admin can view analytics dashboard (leads/city, conversions, revenue, active vendors)
- [ ] **ADMIN-06**: Admin can manage subscription plans and pricing
- [ ] **ADMIN-07**: Admin can view payment logs, commissions, and initiate refunds

### Notifications

- [ ] **NOTF-01**: Vendor receives push notification for new leads (Firebase FCM)
- [ ] **NOTF-02**: Customer receives booking status updates via push notification
- [ ] **NOTF-03**: SMS notifications for OTP and critical booking events
- [ ] **NOTF-04**: Admin receives alerts for vendor KYC submissions and disputes

### Privacy & Compliance

- [ ] **PRIV-01**: Customer phone number is hidden until vendor accepts lead
- [ ] **PRIV-02**: All lead creation requires explicit customer consent
- [ ] **PRIV-03**: Contact reveal events are logged for compliance
- [ ] **PRIV-04**: Data handling follows GDPR-style consent tracking

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Communication

- **COMM-01**: WhatsApp Business API integration for lead alerts and booking updates
- **COMM-02**: In-app real-time chat between customer and vendor
- **COMM-03**: WhatsApp chatbot for automated responses

### Advanced Lead Features

- **ADVL-01**: Lead credit wallet (pay-per-lead alternative to subscription)
- **ADVL-02**: AI-assisted event brief from natural language input
- **ADVL-03**: Vendor response rate scoring affecting lead routing
- **ADVL-04**: City-specific lead surge notifications

### Growth Features

- **GROW-01**: Event inspiration gallery with SEO content pages
- **GROW-02**: Vendor profile strength meter / success score
- **GROW-03**: Multi-city expansion admin tooling
- **GROW-04**: Customer referral program with booking discounts

### Advanced Payments

- **ADVP-01**: Milestone-based payment escrow
- **ADVP-02**: Dynamic pricing suggestions
- **ADVP-03**: B2B net-30 credit terms for verified planners

### Future Tech

- **TECH-01**: AI lead scoring
- **TECH-02**: Vendor portfolio AI photo tagging
- **TECH-03**: AR decoration preview
- **TECH-04**: Real-time vendor availability signal in shortlist

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | Web-first v1; validate model before native investment |
| Open vendor directory with public contacts | Causes disintermediation (JustDial failure mode) |
| Real-time auction/bidding for leads | Race to bottom on price; Urban Company abandoned this |
| Vendor chat before lead acceptance | Leaks customer contacts off-platform |
| Free tier with full lead access | Zero commitment vendors ghost leads, kill customer experience |
| Social media feed / community forum | Scope creep; not core marketplace value |
| In-app event planning tools (seating, RSVP) | Complex standalone product; recommend third-party tools |
| Pan-India simultaneous launch | Requires city-by-city density; start Surat + Ahmedabad |
| Customer loyalty points | Low-frequency category (events); invest in referrals instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| PRIV-01 | Phase 1 | Pending |
| PRIV-02 | Phase 1 | Pending |
| PRIV-03 | Phase 1 | Pending |
| PRIV-04 | Phase 1 | Pending |
| NOTF-03 | Phase 1 | Pending |
| VEND-01 | Phase 2 | Pending |
| VEND-02 | Phase 2 | Pending |
| SUBS-01 | Phase 2 | Pending |
| SUBS-02 | Phase 2 | Pending |
| SUBS-03 | Phase 2 | Pending |
| ADMIN-01 | Phase 2 | Pending |
| ADMIN-02 | Phase 2 | Pending |
| ADMIN-04 | Phase 2 | Pending |
| ADMIN-06 | Phase 2 | Pending |
| NOTF-04 | Phase 2 | Pending |
| CUST-01 | Phase 3 | Pending |
| CUST-02 | Phase 3 | Pending |
| CUST-03 | Phase 3 | Pending |
| CUST-04 | Phase 3 | Pending |
| CUST-05 | Phase 3 | Pending |
| CUST-06 | Phase 3 | Pending |
| LEAD-01 | Phase 3 | Pending |
| LEAD-02 | Phase 3 | Pending |
| LEAD-03 | Phase 3 | Pending |
| LEAD-04 | Phase 3 | Pending |
| LEAD-05 | Phase 3 | Pending |
| LEAD-06 | Phase 3 | Pending |
| NOTF-01 | Phase 3 | Pending |
| VEND-03 | Phase 4 | Pending |
| VEND-04 | Phase 4 | Pending |
| VEND-05 | Phase 4 | Pending |
| VEND-06 | Phase 4 | Pending |
| VEND-07 | Phase 4 | Pending |
| VEND-08 | Phase 4 | Pending |
| CUST-07 | Phase 4 | Pending |
| CUST-08 | Phase 4 | Pending |
| CUST-09 | Phase 4 | Pending |
| CUST-10 | Phase 4 | Pending |
| NOTF-02 | Phase 4 | Pending |
| PAY-01 | Phase 5 | Pending |
| PAY-02 | Phase 5 | Pending |
| PAY-03 | Phase 5 | Pending |
| PAY-04 | Phase 5 | Pending |
| PAY-05 | Phase 5 | Pending |
| SUBS-04 | Phase 5 | Pending |
| SUBS-05 | Phase 5 | Pending |
| ADMIN-07 | Phase 5 | Pending |
| PROD-01 | Phase 6 | Pending |
| PROD-02 | Phase 6 | Pending |
| PROD-03 | Phase 6 | Pending |
| PROD-04 | Phase 6 | Pending |
| PROD-05 | Phase 6 | Pending |
| ADMIN-03 | Phase 7 | Pending |
| ADMIN-05 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 59 total
- Mapped to phases: 59
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation — traceability populated, coverage 59/59*
