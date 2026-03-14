---
phase: 04-vendor-crm-and-booking-flow
plan: "03"
subsystem: booking
tags: [booking, review, notification, socket.io, prisma-transaction, redis, push-notification, firebase, bullmq]
dependency_graph:
  requires:
    - "04-01: InboxGateway.emitToVendor exported from InboxModule"
    - "04-01: Phase 4 Prisma schema — Booking, BookingStatusHistory, Review, BlockedDate models"
    - "04-02: Booking records created by QuoteService.acceptQuote $transaction"
    - "03-03: NotificationService with sendPushToVendor pattern"
    - "03-02: VendorStats model with totalLeadsReceived, totalLeadsWon, averageRating, totalReviewCount"
    - "02-01: VendorOwnerGuard attaches req.vendorId from JWT userId"
    - "01-02: JwtAuthGuard, RolesGuard, JwtPayload interface"
  provides:
    - "PATCH /bookings/:id/status — atomic $transaction status transitions with push notifications at every step"
    - "GET /bookings/:id — booking details with status history, quote line items, vendor and customer info"
    - "POST /vendor/calendar/block — block a calendar date (@db.Date, @@unique duplicate protection)"
    - "DELETE /vendor/calendar/block?date= — unblock a calendar date"
    - "GET /vendor/calendar?year=&month= — blocked dates + booking dates for a month"
    - "GET /vendor/earnings — leadsReceived, leadsWon, completedBookings, totalEarningsPaise"
    - "POST /bookings/:bookingId/review — COMPLETED-gate customer review with incremental VendorStats.averageRating update"
    - "PATCH /reviews/:id/respond — vendor public response (overwrites previous vendorResponse)"
    - "GET /vendor/:vendorId/reviews — public paginated review list (no auth)"
    - "sendPushToCustomer — mirrors sendPushToVendor for customer-side push notifications"
    - "RoutingService.routeDirect + routeTopThree emit new_lead Socket.IO event via InboxGateway"
  affects:
    - "Phase 5: Booking and Review models available for payment integration"
    - "Phase 5: totalEarningsPaise computed from COMPLETED bookings with quote totals"
tech_stack:
  added: []
  patterns:
    - "Booking status machine: BOOKED→IN_PROGRESS|CANCELLED, IN_PROGRESS→COMPLETED|CANCELLED — $transaction updateMany with status filter (TOCTOU-safe)"
    - "Post-transition push: sendPushToCustomer called after every $transaction commit — decoupled from TX"
    - "Incremental average: newAvg = (oldAvg * oldCount + rating) / (oldCount + 1) — O(1), no table scan"
    - "Redis cache invalidation after VendorStats update — outside $transaction (pitfall 4 avoidance)"
    - "emitToVendor called after notifiedAt update — real-time delivery without blocking routing"
    - "Public controller endpoint (no UseGuards at controller level) — GET /vendor/:vendorId/reviews is auth-free"
key_files:
  created:
    - api/src/booking/booking.service.ts
    - api/src/booking/booking.controller.ts
    - api/src/booking/booking.module.ts
    - api/src/booking/dto/transition-status.dto.ts
    - api/src/booking/dto/block-date.dto.ts
    - api/src/review/review.service.ts
    - api/src/review/review.controller.ts
    - api/src/review/review.module.ts
    - api/src/review/dto/create-review.dto.ts
    - api/src/review/dto/respond-review.dto.ts
  modified:
    - api/src/notification/notification.service.ts
    - api/src/routing/routing.service.ts
    - api/src/routing/routing.module.ts
    - api/src/app.module.ts
key-decisions:
  - "[04-03]: BOOKING_PUSH_MESSAGES const at file level — single source of truth for all booking status notification copy"
  - "[04-03]: transitionStatus uses requesterRole from JWT activeRole to determine vendor vs customer auth check — avoids extra DB query when role is clear"
  - "[04-03]: routeTopThree fetches assignmentId before updateMany for emitToVendor payload — findFirst + updateMany pair is safe (vendorId is compound unique key in lead_assignments)"
  - "[04-03]: BookingModule.imports includes VendorModule for VendorOwnerGuard — not added to NotificationModule (PrismaModule and RedisModule are global)"
  - "[04-03]: ReviewController has no class-level UseGuards — public GET endpoint requires no auth, guarded endpoints apply UseGuards per-method"
metrics:
  duration_seconds: 695
  tasks_completed: 2
  files_created: 10
  files_modified: 4
  completed_date: "2026-03-08"
---

# Phase 4 Plan 03: Booking Lifecycle, Reviews, and Real-time Socket.IO Routing — Summary

**Full booking lifecycle (BOOKED→IN_PROGRESS→COMPLETED) with Firebase push at each transition, COMPLETED-gate verified reviews with O(1) incremental rating updates and Redis cache invalidation, and real-time Socket.IO new_lead events wired from RoutingService via InboxGateway.**

## Performance

- **Duration:** ~12 min (695 seconds)
- **Started:** 2026-03-08T18:28:05Z
- **Completed:** 2026-03-08T18:39:40Z
- **Tasks:** 2
- **Files modified:** 14 total (10 created, 4 modified)

## Accomplishments

- BookingService: atomic $transaction status transitions with BOOKING_PUSH_MESSAGES map, completedAt/cancelledAt timestamps, BookingStatusHistory recording, and Lead.status→COMPLETED on booking completion
- ReviewService: COMPLETED-gate createReview with incremental VendorStats.averageRating formula `(oldAvg*oldCount+rating)/(oldCount+1)`, Redis scoring cache invalidation after each review
- RoutingService wired to InboxGateway: emitToVendor called after both routeDirect and routeTopThree assignments — new_lead payload has no phone (contact reveal gate preserved)
- Vendor calendar (blockDate/unblockDate/getVendorCalendar) and earnings dashboard (getVendorEarnings) complete Phase 4 CRM feature set

## Task Commits

1. **Task 1: BookingModule, ReviewModule, sendPushToCustomer** - `47d5270` (feat)
2. **Task 2: Wire RoutingService to InboxGateway** - `1904122` (feat)

## Files Created/Modified

- `api/src/booking/booking.service.ts` — BookingService: transitionStatus, getBooking, blockDate, unblockDate, getVendorCalendar, getVendorEarnings (195 lines)
- `api/src/booking/booking.controller.ts` — 7 routes: GET/PATCH bookings, POST/DELETE/GET vendor calendar, GET vendor earnings
- `api/src/booking/booking.module.ts` — imports NotificationModule and VendorModule
- `api/src/booking/dto/transition-status.dto.ts` — TransitionStatusDto with @IsIn(['IN_PROGRESS','COMPLETED','CANCELLED'])
- `api/src/booking/dto/block-date.dto.ts` — BlockDateDto with @IsDateString
- `api/src/review/review.service.ts` — ReviewService: createReview (COMPLETED gate + incremental avg), respondToReview, getVendorReviews (153 lines)
- `api/src/review/review.controller.ts` — 3 routes: POST (auth CUSTOMER), PATCH (auth VENDOR), GET (public)
- `api/src/review/review.module.ts` — imports VendorModule only (PrismaModule/RedisModule are global)
- `api/src/review/dto/create-review.dto.ts` — CreateReviewDto with @IsInt @Min(1) @Max(5)
- `api/src/review/dto/respond-review.dto.ts` — RespondReviewDto with @IsNotEmpty @MaxLength(2000)
- `api/src/notification/notification.service.ts` — added sendPushToCustomer method (mirrors sendPushToVendor)
- `api/src/routing/routing.service.ts` — injected InboxGateway, emitToVendor calls in routeDirect and routeTopThree
- `api/src/routing/routing.module.ts` — added InboxModule import
- `api/src/app.module.ts` — added BookingModule and ReviewModule imports

## Decisions Made

- `BOOKING_PUSH_MESSAGES` constant at file level: single source of truth for all status-transition notification copy — easy to update without touching logic
- `transitionStatus` uses `requesterRole` from JWT `activeRole` to select the correct authorization check (vendor path vs customer path) — avoids an extra Prisma query when the role already identifies the check
- `routeTopThree` fetches `assignmentId` via `findFirst` before the `updateMany` for the `emitToVendor` payload. This is safe because `leadId + vendorId` is compound unique in lead_assignments, so `findFirst` always resolves to the same assignment as the subsequent `updateMany`
- `ReviewController` applies `UseGuards` per-method (not class-level) because the `GET /vendor/:vendorId/reviews` public endpoint must have no auth guard — mixing public and guarded endpoints in one controller required per-method guard placement

## Deviations from Plan

None — plan executed exactly as written. The server start verification pattern required full env vars (DATABASE_URL, REDIS_URL, JWT_SECRET), consistent with the documented pattern from 04-02.

## Issues Encountered

Server required DATABASE_URL + REDIS_URL to start (crashes with P1012 without it) — consistent with 04-02's documented behavior. Used correct Docker Compose credentials for verification: `zevento:zevento_dev@localhost:5432/zevento_dev`.

## Next Phase Readiness

Phase 4 complete (3/3 plans). All Phase 4 success criteria achievable:
1. Vendor connects via Socket.IO with JWT
2. Lead assigned → RoutingService emits new_lead event in real-time
3. Vendor accepts → InboxService returns phone + PHONE_REVEAL consent
4. Vendor creates + submits quote → Lead.status QUOTES_RECEIVED
5. Customer accepts quote → Booking created, Lead.status BOOKED
6. Booking transitions BOOKED→IN_PROGRESS→COMPLETED with push to customer
7. Customer leaves review → VendorStats.averageRating updated, Redis cache invalidated

Phase 5 (Payments and Payouts) is unblocked. Prerequisite: Razorpay Payout KYC approval (submitted during Phase 2, 2-4 week timeline).

---
*Phase: 04-vendor-crm-and-booking-flow*
*Completed: 2026-03-08*
