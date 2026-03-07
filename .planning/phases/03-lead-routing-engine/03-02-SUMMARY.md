---
phase: 03-lead-routing-engine
plan: 02
subsystem: api, database
tags: [nestjs, prisma, postgis, redis, scoring, consent, lead-routing, geospatial]

# Dependency graph
requires:
  - phase: 03-lead-routing-engine/01
    provides: Lead, LeadAssignment, VendorStats Prisma models, PostGIS extension, CustomerModule
  - phase: 02-vendor-onboarding-subscriptions
    provides: VendorProfile, VendorSubscription, SubscriptionPlan models
  - phase: 01-foundation
    provides: AuthModule (JwtAuthGuard, CurrentUser), ConsentLog model, RedisService
provides:
  - LeadModule with POST /leads/inquiries consent-gated endpoint
  - GET /leads/inquiries paginated customer inquiry listing
  - ScoringService with 5-factor weighted scoring formula
  - PostGIS ST_DWithin vendor distance matching via findVendorsInRange
  - Redis-cached vendor score factors with 5-minute TTL
  - Fairness rotation counter in Redis with 7-day window
  - ScoringService exported for routing module consumption (03-03)
affects: [03-lead-routing-engine/03, 04-booking-payments]

# Tech tracking
tech-stack:
  added: []
  patterns: [consent-gated-endpoint, city-to-market-resolution, weighted-scoring-formula, redis-score-cache, postgis-raw-query]

key-files:
  created:
    - api/src/lead/types/vendor-score.interface.ts
    - api/src/lead/scoring.service.ts
    - api/src/lead/dto/create-inquiry.dto.ts
    - api/src/lead/dto/lead-response.dto.ts
    - api/src/lead/lead.service.ts
    - api/src/lead/lead.controller.ts
    - api/src/lead/lead.module.ts
  modified:
    - api/src/app.module.ts
    - package.json

key-decisions:
  - "Consent recorded as ConsentLog entry inline (not via ConsentRequiredGuard) -- lead creation needs consentLogId for FK link"
  - "CreateInquiryDto validates targetVendorId XOR categoryId at service level -- explicit BadRequestException for both/neither"
  - "ScoringService locationMatch always computed fresh per event (not cached) -- location is event-specific"
  - "Fairness counter uses Redis INCR with 7-day TTL set on first increment -- atomic and self-expiring"

patterns-established:
  - "Consent-gated endpoint: verify consentGiven boolean, record ConsentLog, link consentLogId to created resource"
  - "City-to-market resolution: case-insensitive Prisma findFirst, reject if no market match"
  - "Mode A/B detection: presence of targetVendorId in DTO distinguishes direct vs category routing"
  - "Score factor caching: non-location factors cached in Redis, location + fairness always fresh"

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 3 Plan 2: Lead Submission & Scoring Engine Summary

**Consent-gated lead inquiry endpoint with 5-factor weighted ScoringService, PostGIS vendor distance matching, and Redis-cached score factors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T13:55:49Z
- **Completed:** 2026-03-07T13:59:04Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Built ScoringService with weighted formula (tier 30%, rating 20%, response 20%, location 20%, fairness 10%) and Redis-cached factors
- PostGIS ST_DWithin raw queries find vendors whose service areas cover the event location, with geography cast for meter-based distances
- POST /leads/inquiries endpoint with full consent gate (DPDP Act PRIV-02), city-to-market resolution, and Mode A/B vendor verification
- GET /leads/inquiries returns paginated customer inquiry history with vendor assignment details

## Task Commits

Each task was committed atomically:

1. **Task 1: ScoringService with weighted formula, Redis cache, and PostGIS distance matching** - `ef6c45f` (feat)
2. **Task 2: LeadModule with inquiry creation endpoint and consent gate** - `9634276` (feat)

## Files Created/Modified
- `api/src/lead/types/vendor-score.interface.ts` - VendorScoreFactors interface with 5 scoring dimensions
- `api/src/lead/scoring.service.ts` - Weighted scoring formula, PostGIS distance queries, Redis cache with 5-min TTL
- `api/src/lead/dto/create-inquiry.dto.ts` - CreateInquiryDto with class-validator decorators and mutual exclusion validation
- `api/src/lead/dto/lead-response.dto.ts` - LeadResponseDto with leadId, status, message, createdAt
- `api/src/lead/lead.service.ts` - Lead creation with consent gate, market resolution, Mode A vendor verification
- `api/src/lead/lead.controller.ts` - JwtAuthGuard-protected endpoints: POST and GET /leads/inquiries
- `api/src/lead/lead.module.ts` - LeadModule importing AuthModule, exporting ScoringService for 03-03
- `api/src/app.module.ts` - Added LeadModule to application imports
- `package.json` - Added packageManager field for turbo build compatibility

## Decisions Made
- Consent recorded as inline ConsentLog entry (not via ConsentRequiredGuard) because lead creation needs the consentLogId as a foreign key reference on the Lead record
- CreateInquiryDto validates mutual exclusion of targetVendorId and categoryId at the service level with explicit error messages
- ScoringService computes locationMatch fresh per event (not cached) since location is event-specific while other factors are vendor-intrinsic
- Fairness counter uses Redis INCR with 7-day TTL set atomically on first increment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added packageManager field to root package.json**
- **Found during:** Task 1 (build verification)
- **Issue:** Turbo 2.8.13 requires `packageManager` field in root package.json to resolve workspaces
- **Fix:** Added `"packageManager": "pnpm@10.30.3"` to root package.json
- **Files modified:** package.json
- **Verification:** `pnpm build` passes successfully
- **Committed in:** ef6c45f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Build config fix required for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LeadModule fully functional with consent-gated inquiry creation and customer inquiry listing
- ScoringService exported and ready for BullMQ routing processor consumption in Plan 03-03
- PostGIS distance matching verified in ScoringService for vendor-in-range queries
- Redis caching pattern established for score factors (5-min TTL) and fairness counters (7-day window)
- Ready for Plan 03-03: BullMQ routing processor, Mode A/B routing logic, and push notifications

## Self-Check: PASSED

All 9 files verified present. Both task commits (ef6c45f, 9634276) verified in git log.

---
*Phase: 03-lead-routing-engine*
*Completed: 2026-03-07*
