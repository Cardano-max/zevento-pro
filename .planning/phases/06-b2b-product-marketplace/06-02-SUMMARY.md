---
phase: 06-b2b-product-marketplace
plan: "02"
subsystem: order
tags: [order, payment, razorpay, bullmq, prisma, atomic-stock, marketplace-sale, commission, webhook]
dependency_graph:
  requires:
    - "06-01: ProductOrder, ProductOrderItem, OrderStatusHistory models"
    - "06-01: Product.stock, Product.moq, Product.pricePaise fields"
    - "05-01: CommissionService.getRate with specificity cascade"
    - "05-02: PaymentWebhookService with idempotency + always-200 semantics"
    - "05-02: PaymentProcessor pattern for BullMQ worker structure"
    - "02-01: VendorOwnerGuard attaches req.vendorId"
    - "01-02: JwtAuthGuard, RolesGuard"
  provides:
    - "POST /orders — Planner places product order (atomic stock reserved in $transaction)"
    - "GET /orders/mine — Planner's paginated order history"
    - "GET /orders/vendor — Supplier's order dashboard (VendorOwnerGuard)"
    - "GET /orders/:id — Order detail for buyer, vendor, or admin"
    - "POST /orders/:id/cancel — Cancel PENDING/CONFIRMED order, restores stock"
    - "POST /payments/product-orders — Create Razorpay order for ProductOrder (MARKETPLACE_SALE)"
    - "PaymentWebhookService: routes MARKETPLACE_SALE to product-order-payment queue"
    - "PaymentWebhookService: routes MARKETPLACE_SALE payment.failed to restore stock"
    - "OrderPaymentProcessor: creates MARKETPLACE_SALE Transaction with productOrderId FK"
  affects:
    - "Phase 6 Plan 03 (if any): Transaction records now have productOrderId for reporting"
tech_stack:
  added: []
  patterns:
    - "Atomic stock reservation: Prisma $transaction with per-item findUnique + update(decrement)"
    - "Low-stock alerts enqueued OUTSIDE $transaction (Pitfall 4 — no long-running ops in $transaction)"
    - "Server-side totalPaise: sum(quantity * product.pricePaise), never from client (04-02 decision)"
    - "notes.type routing in webhook: MARKETPLACE_SALE vs BOOKING_COMMISSION vs default"
    - "Commission rate null categoryId for product orders (Pitfall 3 — ProductCategory != EventCategory)"
    - "OrderPaymentProcessor mirrors PaymentProcessor pattern exactly"
    - "Payment failure in MARKETPLACE_SALE restores stock atomically + sets paymentStatus FAILED"
    - "OrderController uses @Controller() with full paths (04-02 QuoteController pattern)"
key_files:
  created:
    - api/src/order/dto/create-order.dto.ts
    - api/src/order/order.service.ts
    - api/src/order/order.controller.ts
    - api/src/order/order.module.ts
    - api/src/order/processor/order-payment.processor.ts
    - api/src/payment/dto/create-product-order-payment.dto.ts
  modified:
    - api/src/payment/payment.service.ts
    - api/src/payment/payment.controller.ts
    - api/src/payment/payment.module.ts
    - api/src/payment/webhook/payment-webhook.service.ts
    - api/src/app.module.ts
key-decisions:
  - "[06-02]: Stock decrement is atomic in Prisma $transaction; low-stock BullMQ alerts enqueued outside (Pitfall 4)"
  - "[06-02]: Commission rate uses getRate(vendorId, null) for product orders — ProductCategory is separate from EventCategory (Pitfall 3)"
  - "[06-02]: Webhook routes by notes.type at handlePaymentCaptured — MARKETPLACE_SALE -> product-order-payment queue, default -> payment-processing queue (existing behavior preserved)"
  - "[06-02]: Payment failure for MARKETPLACE_SALE restores stock atomically via $transaction before setting paymentStatus FAILED"
  - "[06-02]: OrderController has no class-level path (@Controller()) — full paths per endpoint (04-02 QuoteController decision)"
metrics:
  duration_seconds: 479
  tasks_completed: 2
  files_created: 6
  files_modified: 5
  completed_date: "2026-03-13"
---

# Phase 6 Plan 02: B2B Order Placement + Razorpay Checkout + MARKETPLACE_SALE Webhook Routing — Summary

**B2B product order flow end-to-end: atomic stock reservation via Prisma $transaction, Razorpay checkout with MARKETPLACE_SALE notes, webhook routing by notes.type, and OrderPaymentProcessor creating MARKETPLACE_SALE Transactions with commission split.**

## Performance

- **Duration:** ~8 min (479 seconds)
- **Tasks:** 2
- **Files modified:** 11 total (6 created, 5 modified)

## Accomplishments

- OrderService.createOrder: Validates product ownership, MOQ, and active status; uses Prisma $transaction to check stock and atomically decrement for each item; creates ProductOrder + ProductOrderItems + initial OrderStatusHistory in one atomic operation; enqueues low-stock BullMQ alerts outside the transaction
- OrderController: 5 endpoints — POST /orders, GET /orders/mine, GET /orders/vendor (VendorOwnerGuard), GET /orders/:id, POST /orders/:id/cancel
- OrderService.cancelOrder: Validates requester (buyer, vendor owner, or admin), restores stock in $transaction, creates OrderStatusHistory, includes refund advisory note if payment was captured
- PaymentService.createProductOrderPayment: Validates ownership and PENDING status, locks commission at null categoryId (Pitfall 3), creates Razorpay order with notes.type=MARKETPLACE_SALE, updates ProductOrder with razorpayOrderId + commissionRateBps
- PaymentController: POST /payments/product-orders endpoint with PLANNER/CUSTOMER roles
- PaymentWebhookService: handlePaymentCaptured now routes by notes.type — MARKETPLACE_SALE -> product-order-payment queue, default -> existing payment-processing queue (backward-compatible)
- PaymentWebhookService: handlePaymentFailed now routes by notes.type — MARKETPLACE_SALE restores stock atomically + sets paymentStatus FAILED; default keeps existing Booking FAILED behavior
- OrderPaymentProcessor: @Processor('product-order-payment') BullMQ worker — finds ProductOrder by razorpayOrderId, uses locked commissionRateBps (or fallback to CommissionService with null categoryId), creates MARKETPLACE_SALE Transaction with productOrderId FK, updates paymentStatus CAPTURED, marks webhookEvent PROCESSED, sends vendor push notification
- OrderModule: imports PaymentModule (CommissionService), VendorModule (VendorOwnerGuard), NotificationModule; registers stock-alerts and product-order-payment queues; exports OrderService

## Task Commits

1. **Task 1: OrderModule with atomic stock reservation and Razorpay product payment** - `2497d6a` (feat)
2. **Task 2: Extend webhook routing for MARKETPLACE_SALE and add OrderPaymentProcessor** - `368d7f1` (feat)

## Files Created/Modified

- `api/src/order/dto/create-order.dto.ts` — CreateOrderDto + OrderItemDto (vendorId, items array, shippingAddress, note)
- `api/src/order/order.service.ts` — createOrder (atomic $transaction), getOrderById, getMyOrders, getVendorOrders, cancelOrder (stock restore)
- `api/src/order/order.controller.ts` — 5 endpoints with full path pattern (@Controller())
- `api/src/order/order.module.ts` — Module wiring with PaymentModule, VendorModule, NotificationModule, queues
- `api/src/order/processor/order-payment.processor.ts` — BullMQ worker for MARKETPLACE_SALE payment events
- `api/src/payment/dto/create-product-order-payment.dto.ts` — CreateProductOrderPaymentDto with @IsUUID() orderId
- `api/src/payment/payment.service.ts` — Added createProductOrderPayment method
- `api/src/payment/payment.controller.ts` — Added POST /payments/product-orders endpoint
- `api/src/payment/payment.module.ts` — Registered product-order-payment queue
- `api/src/payment/webhook/payment-webhook.service.ts` — notes.type routing in handlePaymentCaptured + handlePaymentFailed
- `api/src/app.module.ts` — Registered OrderModule

## Decisions Made

- Stock decrement is atomic inside Prisma $transaction; low-stock BullMQ alerts are enqueued outside (consistent with Pitfall 4 — no long-running operations in $transaction)
- Commission rate uses `getRate(vendorId, null)` for product orders — `ProductCategory` is a separate taxonomy from `EventCategory`; null categoryId falls through to role-level or global default (Pitfall 3)
- Webhook routing by `notes.type` in `handlePaymentCaptured` is backward-compatible — undefined/null type follows the default path to `payment-processing` (existing booking behavior)
- Payment failure for MARKETPLACE_SALE: stock restored atomically via $transaction, then `paymentStatus` set to FAILED — allows retry by calling POST /payments/product-orders again
- `OrderController` has no class-level route prefix (`@Controller()` with full paths per method) — consistent with QuoteController pattern from Phase 4 Plan 02 decision

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

Plan 06 (if any additional plan) is unblocked. All order placement, payment, and commission settlement infrastructure for the B2B marketplace is in place.

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (2497d6a, 368d7f1) verified in git history.

---
*Phase: 06-b2b-product-marketplace*
*Completed: 2026-03-13*
