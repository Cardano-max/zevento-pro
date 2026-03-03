# Zevento Pro

## What This Is

Zevento Pro is a multi-sided marketplace platform connecting event seekers (customers) with event planners/decorators and product suppliers across India. It combines lead generation, service booking, B2B product marketplace, vendor CRM, and admin analytics into a unified event ecosystem — positioned as "India's IndiaMART + UrbanClap + Amazon for Events."

## Core Value

Customers can discover and book event services (decorators, DJs, mehndi artists, etc.) while the platform intelligently routes qualified leads to the best-matched vendors, creating value for both sides of the marketplace.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-role platform (Customer, Planner, Supplier, Admin)
- [ ] Customer browsing and discovery (categories, planner listings, products)
- [ ] Lead generation system with consent-based creation
- [ ] Lead routing engine with Top 3 vendor scoring algorithm
- [ ] Vendor CRM (lead dashboard, quote generator, booking calendar)
- [ ] B2B product marketplace for event supplies
- [ ] Subscription-based vendor monetization
- [ ] Lead purchase payment model
- [ ] Booking commission system
- [ ] Product marketplace with margin
- [ ] OTP-based authentication
- [ ] Admin panel (vendor approval, lead routing control, analytics, payments)
- [ ] Push notifications (Firebase)
- [ ] Analytics dashboards (planner + admin)
- [ ] City-based service coverage (starting Surat + Ahmedabad)

### Out of Scope

- AI lead scoring — Phase 2 feature, not v1
- WhatsApp chatbot integration — Phase 2
- Dynamic pricing suggestions — Phase 2
- AR decoration preview — Future feature
- Subscription marketplace bundles — Future feature
- Mobile native apps — Web-first v1, mobile apps follow

## Context

- **Founder:** Parth Rohitkumar Mehta, who already operates Kiwi Party (B2B supply), Birthday Kart, decoration manufacturing, and China sourcing — giving existing supply chain and vendor network advantage
- **Market:** Indian event industry, starting in Gujarat (Surat, Ahmedabad) then expanding pan-India
- **Existing assets:** Network of party shops, manufacturing, product supply chain
- **Business model:** 4 revenue engines — vendor subscriptions (Planner: Rs.12,000/mo, Supplier: Rs.36,000/mo), lead sales (Rs.100-500 per lead), booking commissions (5-10%), product marketplace margins
- **Growth targets:** Phase 1: 500 vendors, 100 leads/day; Phase 2: 5,000 vendors, 1,000 leads/day; Phase 3: 30,000 vendors, 10,000 leads/day
- **Lead system is the critical engine** — lead creation only on form submit, book now, or ad leads; consent required before creation
- **Vendor scoring formula:** Subscription Tier (30%) + Rating (20%) + Response Rate (20%) + Distance/City Match (20%) + Fairness Rotation (10%)
- **Routing modes:** Mode A (Single Vendor — direct profile visits), Mode B (Top 3 Vendors — category/general leads, recommended default)

## Constraints

- **Auth**: OTP-based login (phone primary, Indian market standard)
- **Privacy**: Phone numbers visible only after customer consent
- **Compliance**: GDPR-style consent tracking for all lead data
- **Initial geography**: Surat + Ahmedabad for v1, pan-India expansion planned
- **API base**: https://api.zevento.in/v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Top 3 vendor routing as default | IndiaMART model proven, drives vendor competition and onboarding, higher revenue from lead sales | — Pending |
| Web-first, mobile later | Faster to market, validate model before native app investment | — Pending |
| OTP-based auth | Indian market standard, phone-first user base | — Pending |
| Subscription + lead combo revenue | Multiple revenue streams reduce dependency on any single model | — Pending |
| Start Surat + Ahmedabad | Founder's home market, existing vendor relationships | — Pending |

---
*Last updated: 2026-03-04 after initialization*
