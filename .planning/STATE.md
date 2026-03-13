# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Customers can discover and book event services while the platform intelligently routes qualified leads to the best-matched vendors, creating value for both sides of the marketplace.
**Current focus:** Phase 5 (Payments and Commission Settlement) complete. All 3 plans delivered: payment orders, webhook processing, commission calculation, RazorpayX payouts, and admin payment management.

## Current Position

Phase: 5 of 7 (Payments and Commission Settlement) -- COMPLETE
Plan: 3 of 3 in current phase (phase complete)
Status: Phase 05 complete — Payment transaction log, refund initiation, commission rate CRUD, and reconciliation dashboard. Ready for Phase 6 (B2B Product Marketplace).
Last activity: 2026-03-13 — Phase 5 Plan 03 complete

Progress: [███████░░░] 71% (15/21 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 10 min
- Total execution time: 2.54 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 75 min | 25 min |
| 02-vendor-onboarding-subscriptions | 3/3 | 18 min | 6 min |
| 03-lead-routing-engine | 3/3 | 13 min | 4 min |
| 04-vendor-crm-and-booking-flow | 3/3 | 39 min | 13 min |
| 05-payments-and-commission-settlement | 3/3 | 15 min | 5 min |

**Recent Trend:**
- Last 5 plans: 04-03 (12 min), 05-01 (5 min), 05-02 (5 min), 05-03 (5 min)
- Trend: Phase 5 all three plans at 5 min — admin CRUD and payment patterns well-practiced

*Updated after each plan completion*

## Accumulated Context

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

### Pending Todos

None.

### Blockers/Concerns

- [Pre-Phase 1]: TRAI DLT registration — submit OTP + transactional SMS templates to MSG91 before any OTP SMS can be sent. Ops action, not a code task.
- [Pre-Phase 2]: Razorpay Payout (RazorpayX) KYC — submit application during Phase 2; approval timeline 2-4 weeks; missing this gate blocks Phase 5 vendor payouts.
- [Phase 3 resolved]: PostGIS + Prisma integration — resolved with $queryRaw and ST_DWithin geography casting.
- [Phase 5 resolved]: Razorpay commission split — resolved with RazorpayX Payouts (collect full, payout net) instead of Route (linked accounts). GST treated as inclusive in commission rate for MVP.
- [Phase 6 planning]: Kiwi Party / Birthday Kart integration contract must be defined before Phase 6 begins (Shopify webhook vs. CSV vs. custom API determines entire B2B architecture).
- [Legal]: India DPDP Act consent implementation rules are evolving — get legal review before launch.

## Session Continuity

Last session: 2026-03-13
Stopped at: Completed 05-03-PLAN.md — Admin payment log, refund initiation, commission rate CRUD, reconciliation. Phase 5 complete. Ready for Phase 6 (B2B Product Marketplace).
Resume file: None
