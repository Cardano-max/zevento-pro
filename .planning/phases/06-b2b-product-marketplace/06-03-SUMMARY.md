---
phase: 06-b2b-product-marketplace
plan: "03"
subsystem: order
tags: [order, state-machine, status-transitions, push-notifications, stock-restore, bullmq, prisma, atomic]
dependency_graph:
  requires:
    - "06-01: ProductOrder, ProductOrderItem, OrderStatusHistory models"
    - "06-01: Product.stock fields for increment on cancellation"
    - "06-02: OrderService with createOrder, cancelOrder, getOrderById, getMyOrders, getVendorOrders"
    - "06-02: OrderModule with NotificationModule already imported"
    - "04-03: BookingService.transitionStatus pattern — BOOKING_PUSH_MESSAGES, updateMany status filter, TOCTOU guard"
    - "03-03: NotificationService.sendPushToCustomer and sendPushToVendor signatures"
  provides:
    - "PATCH /orders/:id/status — Supplier/admin advances order through lifecycle state machine"
    - "OrderService.transitionOrderStatus with VALID_ORDER_TRANSITIONS, stock restore on CANCELLED, OrderStatusHistory, push notifications"
    - "cancelOrder delegates to transitionOrderStatus for consistent state machine behavior"
    - "Push notification to buyer on every status transition (title/body via ORDER_STATUS_MESSAGES)"
    - "Push notification to vendor when buyer cancels order"
    - "Atomic updateMany with status filter — race condition protection (TOCTOU guard)"
  affects:
    - "Complete B2B Product Marketplace (Phase 6 fully done — all 4 success criteria met)"
tech_stack:
  added: []
  patterns:
    - "VALID_ORDER_TRANSITIONS const at file level — mirrors VALID_TRANSITIONS from BookingService (04-03 pattern)"
    - "ORDER_STATUS_MESSAGES const at file level — mirrors BOOKING_PUSH_MESSAGES (04-03 pattern)"
    - "updateMany with { where: { id, status: currentStatus } } for atomic TOCTOU-safe status transition"
    - "Stock restore via increment inside same $transaction as status update — prevents stock leak"
    - "Push notifications sent OUTSIDE $transaction — consistent with Pitfall 4 (no long-running ops in $transaction)"
    - "cancelOrder as a thin wrapper delegating to transitionOrderStatus — single source of truth for state machine"
key-files:
  created:
    - api/src/order/dto/transition-order-status.dto.ts
  modified:
    - api/src/order/order.service.ts
    - api/src/order/order.controller.ts
key-decisions:
  - "[06-03]: cancelOrder delegates to transitionOrderStatus internally — single state machine, no duplication"
  - "[06-03]: Buyer (PLANNER/CUSTOMER) authorization: can only CANCEL, and only from PENDING/CONFIRMED — ForbiddenException otherwise"
  - "[06-03]: DELIVERED and CANCELLED are terminal states — no entry in VALID_ORDER_TRANSITIONS, allowedTransitions returns [] (empty array) for them"
  - "[06-03]: Stock restore is inside same $transaction as updateMany — prevents stock leak if transition fails mid-way"
  - "[06-03]: sendPushToVendor called when buyer cancels — vendor is notified of buyer-initiated cancellations; vendor-initiated cancellations only notify buyer"
patterns-established:
  - "Order state machine: PENDING_TRANSITIONS_MAP → validate → atomic updateMany → history record → stock restore if CANCEL → push outside tx"
  - "VALID_ORDER_TRANSITIONS and ORDER_STATUS_MESSAGES as module-level consts — same as BookingService"
metrics:
  duration_seconds: 181
  tasks_completed: 1
  files_created: 1
  files_modified: 2
  completed_date: "2026-03-13"
---

# Phase 6 Plan 03: Order Lifecycle State Machine — Summary

**Order status state machine (PENDING→CONFIRMED→DISPATCHED→DELIVERED) with TOCTOU-safe atomic transitions, stock restoration on cancellation, OrderStatusHistory logging, and push notifications to buyer on every state change.**

## Performance

- **Duration:** ~3 min (181 seconds)
- **Tasks:** 1
- **Files modified:** 3 total (1 created, 2 modified)

## Accomplishments

- OrderService.transitionOrderStatus: full state machine with VALID_ORDER_TRANSITIONS map, authorization check (supplier/buyer/admin), atomic `updateMany` with status filter guard, OrderStatusHistory on every transition, stock `increment` inside same `$transaction` on CANCELLED, push notifications outside transaction
- ORDER_STATUS_MESSAGES const with title/body for CONFIRMED, DISPATCHED, DELIVERED, CANCELLED — mirrors BOOKING_PUSH_MESSAGES pattern from Phase 4 Plan 03
- cancelOrder refactored to delegate to transitionOrderStatus — single source of truth for all order status changes
- PATCH /orders/:id/status endpoint in OrderController with ParseUUIDPipe, roles: SUPPLIER, PLANNER, CUSTOMER, ADMIN
- NotificationService injected into OrderService constructor (NotificationModule already in OrderModule imports from Plan 06-02)
- Phase 6 is now fully complete — all 4 marketplace success criteria satisfied

## Task Commits

1. **Task 1: Order lifecycle state machine with transitions, stock restoration, and push notifications** — `a2df7d2` (feat)

## Files Created/Modified

- `api/src/order/dto/transition-order-status.dto.ts` — TransitionOrderStatusDto with @IsEnum(ProductOrderStatus) + optional @IsString() note
- `api/src/order/order.service.ts` — Added VALID_ORDER_TRANSITIONS const, ORDER_STATUS_MESSAGES const, NotificationService injection, transitionOrderStatus method; cancelOrder delegates to transitionOrderStatus
- `api/src/order/order.controller.ts` — Added PATCH /orders/:id/status with ParseUUIDPipe, Patch import; updated JSDoc

## Decisions Made

- cancelOrder delegates to transitionOrderStatus internally: single state machine, consistent behavior, no duplicated stock restore logic
- Buyer authorization for PATCH /orders/:id/status is permissive at the guard level (PLANNER/CUSTOMER allowed) but checked strictly at service level — buyer can only CANCEL and only from PENDING/CONFIRMED
- DELIVERED and CANCELLED have no entries in VALID_ORDER_TRANSITIONS — empty array returned → BadRequestException("terminal state") prevents any further transitions
- Stock restore is inside the same `$transaction` as updateMany and OrderStatusHistory creation — if any step fails, all roll back atomically (no stock leak)
- sendPushToVendor called only when buyer initiates the cancellation — when supplier cancels, buyer gets notified via sendPushToCustomer only

## Deviations from Plan

None — plan executed exactly as written. The plan noted the reconciliation choice for cancelOrder; implemented as "cancelOrder delegates to transitionOrderStatus" as recommended.

## Issues Encountered

None — NotificationModule was already imported in OrderModule from Plan 06-02, so no module changes were needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 6 (B2B Product Marketplace) is complete. All 4 success criteria met:
- SC1: Supplier product CRUD with stock decrement + low-stock alerts (06-01)
- SC2: Planner catalog browse + search by category/price (06-01)
- SC3: Planner places order + pays via Razorpay → appears in supplier dashboard (06-02)
- SC4: Supplier advances order PENDING→CONFIRMED→DISPATCHED→DELIVERED; planner sees real-time status via GET /orders/:id (06-03)

Phase 7 can begin.

## Self-Check: PASSED

---
*Phase: 06-b2b-product-marketplace*
*Completed: 2026-03-13*
