---
phase: 03-lead-routing-engine
plan: 03
subsystem: api
tags: [bullmq, firebase-admin, fcm, push-notifications, async-routing, redis, postgis]

# Dependency graph
requires:
  - phase: 03-02
    provides: "Lead inquiry endpoint, ScoringService with weighted formula, PostGIS distance queries"
provides:
  - "BullMQ async lead routing (Mode A direct + Mode B Top 3)"
  - "Fairness rotation cap (Redis INCR with 7-day TTL)"
  - "Firebase FCM push notifications with dev mock fallback"
  - "Device token registration endpoint"
affects: [04-booking-calendar, 05-payment-commission]

# Tech tracking
tech-stack:
  added: ["@nestjs/bullmq", "bullmq", "firebase-admin"]
  patterns: ["BullMQ WorkerHost processor", "Firebase mock mode (no env vars)", "REDIS_URL parsing for BullModule.forRoot"]

key-files:
  created:
    - api/src/routing/routing.constants.ts
    - api/src/routing/routing.service.ts
    - api/src/routing/routing.processor.ts
    - api/src/routing/routing.module.ts
    - api/src/notification/notification.service.ts
    - api/src/notification/notification.controller.ts
    - api/src/notification/notification.module.ts
    - api/src/notification/dto/register-device.dto.ts
  modified:
    - api/src/lead/lead.service.ts
    - api/src/lead/lead.module.ts
    - api/src/app.module.ts
    - api/package.json

key-decisions:
  - "BullModule.forRoot parses REDIS_URL into host/port — cannot share ioredis instance (maxRetriesPerRequest must be null for workers)"
  - "Firebase mock mode logs push notifications to console when env vars missing — consistent with MSG91/Cloudinary/Razorpay dev mock pattern"
  - "Fairness cap checked at routing time (not scoring time) — separate concern from score computation"

patterns-established:
  - "BullMQ WorkerHost pattern: Processor extends WorkerHost, @OnWorkerEvent for failure logging"
  - "Firebase dev mock: check FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY on init, set mockMode flag"
  - "Promise.allSettled for batch push notifications — partial failure tolerance"

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 03 Plan 03: Async Routing Engine & Push Notifications Summary

**BullMQ async lead routing (Mode A direct + Mode B Top-3 scored) with fairness rotation cap and Firebase FCM push notifications**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T14:32:54Z
- **Completed:** 2026-03-07T14:38:31Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- BullMQ lead-routing queue processes routing jobs asynchronously with 3 retries and exponential backoff
- Mode A routes directly to target vendor; Mode B scores eligible vendors via PostGIS + weighted formula and assigns Top 3
- Fairness rotation cap (Redis INCR with 7-day TTL, max 50 leads/window) prevents vendor overload
- Firebase FCM push notifications sent to assigned vendors (dev mock when env vars missing)
- Device token registration endpoint with auto-deactivation of invalid/expired tokens
- Full pipeline wired: inquiry -> consent -> lead -> queue -> route -> score -> assign -> notify

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, create NotificationModule with FCM push and device registration** - `00b4646` (feat)
2. **Task 2: Create RoutingModule with BullMQ processor, Mode A/B routing, fairness cap, and wire lead creation to enqueue** - `fcaf006` (feat)

## Files Created/Modified
- `api/src/routing/routing.constants.ts` - Queue name, job name, Top N, fairness window constants
- `api/src/routing/routing.service.ts` - routeDirect (Mode A) and routeTopThree (Mode B) with fairness cap
- `api/src/routing/routing.processor.ts` - BullMQ WorkerHost processor for lead-routing queue
- `api/src/routing/routing.module.ts` - RoutingModule importing LeadModule and NotificationModule
- `api/src/notification/notification.service.ts` - Firebase FCM push with dev mock fallback
- `api/src/notification/notification.controller.ts` - POST /notifications/register-device endpoint
- `api/src/notification/notification.module.ts` - NotificationModule exporting NotificationService
- `api/src/notification/dto/register-device.dto.ts` - Token + platform validation DTO
- `api/src/lead/lead.service.ts` - Added @InjectQueue and routing job enqueue after lead creation
- `api/src/lead/lead.module.ts` - Added BullModule.registerQueue import
- `api/src/app.module.ts` - Added BullModule.forRoot, NotificationModule, RoutingModule

## Decisions Made
- BullModule.forRoot parses REDIS_URL into host/port — BullMQ requires its own connection config with maxRetriesPerRequest: null, so it cannot share the ioredis instance from RedisService
- Firebase mock mode logs push notifications to console when FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY env vars missing — consistent with MSG91, Cloudinary, and Razorpay dev mock patterns
- Fairness cap checked at routing time (not scoring time) — keeps scoring pure and separation of concerns clear

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Firebase notifications run in mock mode until FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables are configured.

## Next Phase Readiness
- Phase 03 (Lead Routing Engine) is now complete
- Full lead pipeline operational: customer inquiry -> consent -> lead creation -> async routing -> vendor scoring -> assignment -> push notification
- Ready for Phase 04 (Booking Calendar) which builds on lead assignments

## Self-Check: PASSED

All 8 created files verified on disk. Both task commits (00b4646, fcaf006) confirmed in git log.

---
*Phase: 03-lead-routing-engine*
*Completed: 2026-03-07*
