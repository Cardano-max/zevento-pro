# Phase 2: Vendor Onboarding and Subscriptions - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Vendors (Planners and Suppliers) can register, build business profiles, upload portfolio photos, define service areas, select subscription plans with Razorpay billing, and submit for KYC approval. Admins can manage the KYC queue, event categories, and subscription plan definitions. Lead routing, booking, and payment flows are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Vendor onboarding flow
- Progressive step-by-step onboarding (not single form)
- Step 1: Phone + Name + Role (Planner/Supplier) — uses existing OTP auth from Phase 1
- Step 2: Business name, categories, pricing ranges
- Step 3: Portfolio photos (tagged by event type)
- Step 4: Service cities + coverage radius
- Step 5: Submit for KYC review
- Vendor can save progress and return to complete later

### KYC documents
- Flexible per role: Planners need Aadhaar or PAN (many are freelancers without GST). Suppliers need GST certificate required (B2B tax invoicing needs it)
- Both roles upload identity document + business proof where applicable

### Claude's Discretion
- **Planner vs Supplier onboarding divergence** — Same flow with role-specific fields vs separate flows. Claude picks based on schema and code reuse.
- **Minimum portfolio requirements** — Claude decides based on marketplace quality vs onboarding friction trade-off (e.g., minimum 1-3 photos or optional at submission).
- **Service area definition** — City dropdown + radius, map pin + radius, or city-only. Claude picks based on Phase 3 PostGIS lead routing requirements.
- **Vendor pending state** — What vendors can do while KYC is pending (profile visible but no leads, fully blocked, or full access flagged). Claude picks best balance of quality vs speed.
- **KYC rejection handling** — Reject with reason + re-submit vs permanent rejection. Claude decides.
- **Auto-approval path** — Always manual vs auto-approve if docs valid vs manual-for-now. Claude picks based on current scale (early stage, low volume).
- **Subscription plan trial period** — Whether to offer free trial, grace period on lapse, and what happens when subscription expires.
- **Admin panel workflow** — KYC approval queue design, category management depth, vendor lifecycle actions (suspend, reactivate).

</decisions>

<specifics>
## Specific Ideas

- SRS doc specifies Planner subscription at Rs.12,000/month and Supplier at Rs.36,000/month
- First category focus: Birthday Decoration + Balloon Decor (from SRS)
- Razorpay Subscriptions API for recurring billing with auto-renewal
- Cloudinary for portfolio image hosting (from roadmap)
- Service area must be PostGIS-ready for Phase 3 distance matching
- Razorpay Payout KYC application must be submitted during Phase 2 (approval takes 2-4 weeks; blocks Phase 5 vendor payouts) — ops action tracked in STATE.md blockers

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-vendor-onboarding-subscriptions*
*Context gathered: 2026-03-06*
