---
phase: 07-analytics-and-admin-hardening
plan: "01"
subsystem: api
tags: [prisma, analytics, groupBy, admin-dashboard, nestjs]

# Dependency graph
requires:
  - phase: 02-vendor-onboarding-subscriptions
    provides: VendorProfile with status and subscription relation
  - phase: 03-lead-routing-engine
    provides: Lead model with city and status fields
  - phase: 05-payments-and-commission-settlement
    provides: Transaction model with type, status, amountPaise
provides:
  - GET /admin/analytics/dashboard endpoint with leadsPerCity, conversionFunnel, revenueByStream, activeVendorCount
  - AnalyticsQueryDto with optional dateFrom/dateTo time window
  - getAnalyticsDashboard service method using Prisma groupBy + aggregate in parallel
affects: [07-02-admin-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: [Prisma groupBy aggregation in Promise.all for dashboard analytics]

key-files:
  created:
    - api/src/admin/dto/analytics-query.dto.ts
  modified:
    - api/src/admin/admin.service.ts
    - api/src/admin/admin.controller.ts

key-decisions:
  - "FUNNEL_ORDER defined as static readonly constant on AdminService class -- single source of truth for 8-stage conversion funnel ordering"
  - "activeVendorCount filters on subscription status IN ['ACTIVE','AUTHENTICATED'] -- consistent with vendor search visibility pattern from Phase 3"

patterns-established:
  - "Prisma groupBy + Promise.all pattern for multi-metric dashboard aggregation"

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 7 Plan 01: Analytics Dashboard Summary

**Live analytics dashboard endpoint aggregating leadsPerCity, 8-stage conversionFunnel, revenueByStream, and activeVendorCount via Prisma groupBy with configurable time window**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T10:32:55Z
- **Completed:** 2026-03-13T10:34:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- AnalyticsQueryDto with optional dateFrom/dateTo ISO date params validated by class-validator
- getAnalyticsDashboard() runs four Prisma queries in parallel via Promise.all: leadsPerCity groupBy, conversion funnel groupBy, revenue groupBy, active vendor count
- Conversion funnel normalized to 8-stage ordered array (PENDING through CANCELLED) with zero-filled missing stages
- GET /admin/analytics/dashboard wired with existing JwtAuthGuard + RolesGuard (ADMIN role)

## Task Commits

Each task was committed atomically:

1. **Task 1: AnalyticsQueryDto and getAnalyticsDashboard service method** - `049bc1a` (feat)
2. **Task 2: Wire GET /admin/analytics/dashboard endpoint** - `2069d76` (feat)

## Files Created/Modified
- `api/src/admin/dto/analytics-query.dto.ts` - Optional dateFrom/dateTo query DTO with IsDateString validation
- `api/src/admin/admin.service.ts` - Added FUNNEL_ORDER constant and getAnalyticsDashboard() with 4 parallel Prisma queries
- `api/src/admin/admin.controller.ts` - Added GET analytics/dashboard endpoint with AnalyticsQueryDto query params

## Decisions Made
- FUNNEL_ORDER defined as `private static readonly` on AdminService class -- keeps the ordering constant co-located with the method that uses it
- activeVendorCount uses `subscription: { status: { in: ['ACTIVE', 'AUTHENTICATED'] } }` -- consistent with vendor search filter pattern established in Phase 3 (03-01)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analytics dashboard endpoint ready for admin frontend consumption
- Plan 07-02 (admin hardening) can proceed independently

## Self-Check: PASSED

All files exist, all commits verified, all key links confirmed.

---
*Phase: 07-analytics-and-admin-hardening*
*Completed: 2026-03-13*
