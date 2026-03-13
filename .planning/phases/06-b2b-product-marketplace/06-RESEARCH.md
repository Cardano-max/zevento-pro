# Phase 6: B2B Product Marketplace - Research

**Researched:** 2026-03-13
**Domain:** Product catalog management, inventory tracking with stock reservation, B2B order lifecycle, Razorpay marketplace payments, Cloudinary multi-image upload
**Confidence:** HIGH

## Summary

Phase 6 introduces a B2B product marketplace where suppliers list physical products (party decorations, event supplies) and planners browse, order, and track procurement. The existing codebase provides nearly everything needed: CloudinaryService (image upload with dev mock mode), RazorpayService (order creation + payment verification), CommissionService (specificity cascade with MARKETPLACE_SALE support), Transaction model (already has the MARKETPLACE_SALE type), BullMQ (globally configured), NotificationService (push to vendor and customer), and VendorOwnerGuard (attaches vendorId to req, ADMIN bypasses). The VendorProfile model already has a `role` field distinguishing PLANNER and SUPPLIER roles -- only SUPPLIERs should manage products.

The primary technical challenges are: (1) **stock reservation and atomic decrement** to prevent overselling under concurrent orders, (2) **product image management** with multiple images per product (existing pattern handles single-file upload via FileInterceptor -- products need FilesInterceptor for multi-image or repeated single-image uploads), and (3) **a new Order entity separate from Booking** since B2B product orders have a fundamentally different lifecycle (Pending > Confirmed > Dispatched > Delivered) than service bookings (Booked > In Progress > Completed). The payment flow reuses the existing Razorpay Orders API pattern from Phase 5, with MARKETPLACE_SALE as the transaction type and commission rates looked up via CommissionService.

The blocker regarding Kiwi Party / Birthday Kart integration is explicitly deferred -- this phase builds platform-native product management where suppliers list products directly on Zevento. External supplier integration (Shopify webhook, CSV import, custom API) can be layered on later without rearchitecting, because the Product model is supplier-agnostic (vendorId FK to VendorProfile, fulfillmentSource field for future differentiation).

**Primary recommendation:** Add Product, ProductImage, ProductCategory, and ProductOrder Prisma models. Reuse existing CloudinaryService, RazorpayService, CommissionService, and NotificationService. Use Prisma atomic `decrement` within `$transaction` for stock management. Follow the BookingService state machine pattern for order lifecycle transitions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | 6.4.1 (installed) | Product, ProductImage, ProductOrder models; atomic stock operations | Already the project ORM; `update({ data: { stock: { decrement: N } } })` handles atomic stock changes |
| @nestjs/bullmq | 11.0.4 (installed) | Low-stock alert processing, order notification queues | Already configured globally in app.module.ts |
| cloudinary | 2.9.0 (installed) | Product image upload/delete via CloudinaryService | CloudinaryService already has uploadImage/deleteImage with dev mock mode |
| razorpay | 2.9.6 (installed) | Product order payment via RazorpayService.createOrder | Same Orders API pattern used for booking payments in Phase 5 |
| class-validator | 0.15.1 (installed) | DTO validation for product listing, search, order DTOs | Already used throughout the codebase |
| class-transformer | 0.5.1 (installed) | DTO transformation (Type decorator for query params) | Already used in SearchVendorsDto pattern |
| multer | 2.1.1 (installed) | Multi-file upload handling via FilesInterceptor | Already used for single-file upload in vendor portfolio/KYC |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| firebase-admin | 13.7.0 (installed) | Push notifications for low-stock alerts and order updates | NotificationService already wraps this |
| ioredis | 5.4.2 (installed) | BullMQ backing store | Already configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma atomic decrement | PostgreSQL CHECK constraint (stock >= 0) | CHECK constraint is a safety net but doesn't prevent the operation -- it throws a DB error. Prefer application-level check + atomic decrement in $transaction. Add CHECK constraint as defense-in-depth via custom migration. |
| ProductCategory (separate table) | EventCategory (reuse existing) | EventCategory is for event service types (Wedding, Birthday). Products have different categories (Balloons, Ribbons, Tableware). Separate ProductCategory table avoids confusion and allows product-specific hierarchy. |
| Separate ProductOrder model | Extend Booking model | Booking is tightly coupled to Lead > Quote > Booking flow. Product orders have no lead, no quote -- they have a cart-like flow with quantity + direct purchase. Separate model is cleaner. |
| FilesInterceptor (multiple files) | Repeated single FileInterceptor calls | FilesInterceptor handles multi-file upload in one request. But existing CloudinaryService.uploadImage takes single file -- loop over files array is simple. Either approach works. |

**No new installations needed.** All required libraries are already installed.

## Architecture Patterns

### Recommended Module Structure
```
api/src/
  product/                                # NEW MODULE
    product.module.ts                     # ProductModule -- imports CloudinaryModule, NotificationModule, VendorModule, BullModule, PaymentModule
    product.controller.ts                 # Supplier product management endpoints (CRUD)
    product.service.ts                    # Product CRUD, image management, stock operations
    catalog.controller.ts                 # Planner-facing browse/search endpoints (public or PLANNER role)
    catalog.service.ts                    # Product search, filtering, pagination
    dto/
      create-product.dto.ts              # { name, categoryId, pricePaise, stock, lowStockThreshold, description, moq }
      update-product.dto.ts              # Partial of create, all fields optional
      search-products.dto.ts             # { search?, categoryId?, priceMin?, priceMax?, vendorId?, page, limit }
  order/                                  # NEW MODULE
    order.module.ts                       # OrderModule -- imports ProductModule, PaymentModule, NotificationModule, BullModule
    order.controller.ts                   # Planner order placement + tracking; Supplier order management
    order.service.ts                      # Order creation (with stock reservation), payment, status transitions
    processor/
      order-stock.processor.ts           # BullMQ processor: low-stock alert checks after order confirmation
    dto/
      create-order.dto.ts                # { items: [{ productId, quantity }] }
      transition-order-status.dto.ts     # { status: 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED', note? }
```

### Pattern 1: Atomic Stock Decrement with Prisma $transaction
**What:** Prevent overselling by atomically decrementing stock within a Prisma interactive transaction, with a pre-check that sufficient stock exists.
**When to use:** Every time a product order is confirmed (stock reservation at order placement).

```typescript
// Source: Prisma docs - CRUD atomic operations + interactive transactions
async reserveStock(items: { productId: string; quantity: number }[]) {
  return this.prisma.$transaction(async (tx) => {
    for (const item of items) {
      // 1. Check current stock (within transaction for consistency)
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, stock: true },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}": requested ${item.quantity}, available ${product.stock}`,
        );
      }

      // 2. Atomic decrement (database-level, prevents race conditions)
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }
  });
}
```

### Pattern 2: Order Lifecycle State Machine (mirrors BookingService)
**What:** Status transition with validation, atomic update via updateMany with status filter, and status history logging.
**When to use:** Every order status change (Pending > Confirmed > Dispatched > Delivered).

```typescript
// Source: Existing BookingService.transitionStatus pattern
const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED'],
};

// Inside $transaction:
const updated = await tx.productOrder.updateMany({
  where: { id: orderId, status: currentStatus },
  data: {
    status: dto.status,
    confirmedAt: dto.status === 'CONFIRMED' ? new Date() : undefined,
    dispatchedAt: dto.status === 'DISPATCHED' ? new Date() : undefined,
    deliveredAt: dto.status === 'DELIVERED' ? new Date() : undefined,
  },
});

if (updated.count === 0) {
  throw new BadRequestException('Order status conflict');
}

await tx.orderStatusHistory.create({
  data: { orderId, fromStatus: currentStatus, toStatus: dto.status, note: dto.note },
});
```

### Pattern 3: Multi-Image Product Upload
**What:** Upload multiple images per product using existing CloudinaryService in a loop.
**When to use:** Product creation and image management.

```typescript
// Source: Existing VendorController FileInterceptor pattern + CloudinaryService
@Post(':productId/images')
@UseGuards(VendorOwnerGuard)
@UseInterceptors(
  FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }),
)
async uploadProductImage(
  @Req() req: any,
  @Param('productId', ParseUUIDPipe) productId: string,
  @UploadedFile() file: Express.Multer.File,
) {
  return this.productService.addImage(req.vendorId, productId, file);
}
```

### Pattern 4: Reusing Payment Flow for Product Orders
**What:** Create Razorpay order for product order, verify payment, process via webhook -- identical to booking payment flow.
**When to use:** Planner pays for a product order.

```typescript
// Source: Existing PaymentService.createBookingOrder pattern
// Notes field uses type: 'MARKETPLACE_SALE' for webhook routing
const order = await this.razorpayService.createOrder({
  amount: totalPaise,
  currency: 'INR',
  receipt: `pord_${productOrder.id.substring(0, 30)}`,
  notes: {
    productOrderId: productOrder.id,
    vendorId: productOrder.vendorId,
    customerId: productOrder.buyerId,
    type: 'MARKETPLACE_SALE',
    commissionRateBps: String(commissionRateBps),
  },
});
```

### Anti-Patterns to Avoid
- **Stock check without transaction:** Never check stock in one query and decrement in another without a transaction -- TOCTOU race condition.
- **Decrement in webhook handler:** Stock reservation should happen at order placement (synchronous), not at payment capture (async). If payment fails, release stock via compensation.
- **Sharing Booking model for product orders:** Product orders have different lifecycle, no Lead/Quote dependency, different fields (items array, shipping address). Separate model prevents coupling.
- **Allowing negative stock via application logic:** Always check `product.stock >= requestedQuantity` before decrement. Add PostgreSQL CHECK constraint (`stock >= 0`) as defense-in-depth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image upload/resize | Custom upload pipeline | CloudinaryService (existing) | Already handles streaming upload, auto-quality, dev mock mode |
| Payment processing | Custom payment flow | RazorpayService + PaymentWebhookService pattern (existing) | Signature verification, idempotency, async BullMQ processing all proven |
| Commission calculation | Inline percentage math | CommissionService.getRate (existing) | Specificity cascade, effective date ranges, role-based rates already implemented |
| Push notifications | Direct Firebase calls | NotificationService (existing) | Token management, mock mode, multi-device support all handled |
| File validation | Manual mimetype checking | imageFileFilter function (existing in vendor.controller.ts) | Already validates JPEG/PNG/WebP with proper error messages |
| Pagination | Custom offset/limit logic | SearchVendorsDto pattern (existing) | page/limit with @Type(() => Number), @Min, @Max already proven |
| Webhook idempotency | Custom dedup logic | WebhookEvent model + P2002 catch pattern (existing) | Proven in subscription and payment webhooks |

**Key insight:** This phase is primarily about *data modeling* (Product, ProductImage, ProductOrder) and *business logic* (stock management, order lifecycle). The infrastructure layer (images, payments, notifications, queues) is entirely built and needs only to be wired to new models.

## Common Pitfalls

### Pitfall 1: Stock Overselling Under Concurrent Orders
**What goes wrong:** Two planners order the last 5 items simultaneously. Without atomic operations, both succeed and stock goes to -5.
**Why it happens:** Check-then-decrement without transaction isolation.
**How to avoid:** Use Prisma `$transaction` with `findUnique` (to check) + `update({ data: { stock: { decrement } } })` (to decrement) in the same interactive transaction. Add a PostgreSQL CHECK constraint (`ALTER TABLE products ADD CONSTRAINT stock_non_negative CHECK (stock >= 0)`) via custom migration as defense-in-depth.
**Warning signs:** Stock values going negative in database, customer complaints about "confirmed but unavailable" orders.

### Pitfall 2: Stock Not Released on Payment Failure / Order Cancellation
**What goes wrong:** Stock is decremented at order placement but never restored when payment fails or order is cancelled. Eventually all products show "out of stock" despite no deliveries.
**Why it happens:** Missing compensation logic in failure paths.
**How to avoid:** On CANCELLED transition or payment failure, increment stock back. Use `update({ data: { stock: { increment: quantity } } })`. Track `stockReserved` boolean on order items to prevent double-release.
**Warning signs:** Stock counts consistently lower than actual warehouse inventory.

### Pitfall 3: Commission Rate Lookup Without Product Category
**What goes wrong:** CommissionService.getRate looks up by vendorId + categoryId. Product categories are different from event categories (EventCategory). Passing a ProductCategory ID to a method that queries CommissionRate (which FK's to EventCategory) returns no match.
**Why it happens:** CommissionRate.categoryId references EventCategory, but products use ProductCategory.
**How to avoid:** For MARKETPLACE_SALE transactions, use `getRate(vendorId, null)` to get the vendor-role-based or global default rate. Or add a separate commission lookup path for product categories. The simplest approach: configure a global MARKETPLACE_SALE rate (e.g., 1000 bps = 10%) that applies to all product sales regardless of product category, using vendorRole='SUPPLIER' in the CommissionRate table.
**Warning signs:** `InternalServerErrorException('No commission rate configured')` when processing product order payments.

### Pitfall 4: Product Ownership Not Checked on Mutations
**What goes wrong:** VendorOwnerGuard attaches `req.vendorId` from JWT, but product update/delete endpoints don't verify the product belongs to that vendor. A supplier could edit another supplier's products.
**Why it happens:** Guard provides vendorId but doesn't check resource ownership.
**How to avoid:** Always verify `product.vendorId === req.vendorId` before any mutation. Same pattern as `deletePhoto` in VendorService.
**Warning signs:** Products appearing/disappearing without the owning supplier's action.

### Pitfall 5: Product Image Orphans in Cloudinary
**What goes wrong:** Product is deleted but its Cloudinary images are not cleaned up. Over time, Cloudinary storage fills with unreferenced images.
**Why it happens:** Missing cascade cleanup logic.
**How to avoid:** When deleting a product, first delete all ProductImage records and their Cloudinary assets (loop + `cloudinary.deleteImage`), then delete the product. Use `$transaction` for atomicity.
**Warning signs:** Cloudinary usage/cost growing without corresponding product count growth.

### Pitfall 6: Missing Supplier Role Check on Product Endpoints
**What goes wrong:** A PLANNER creates product listings (only SUPPLIERs should manage products in the marketplace).
**Why it happens:** VendorOwnerGuard works for any vendor role. Product endpoints need `@Roles('SUPPLIER')` specifically.
**How to avoid:** Use `@Roles('SUPPLIER')` on product management controller, not `@Roles('PLANNER', 'SUPPLIER')`. Planner-facing catalog browsing uses `@Roles('PLANNER', 'CUSTOMER')` or is public.
**Warning signs:** Products listed by non-supplier accounts.

### Pitfall 7: Transaction Model Missing ProductOrder Reference
**What goes wrong:** The existing Transaction model has `bookingId` FK but no `productOrderId` FK. MARKETPLACE_SALE transactions cannot be linked to their source order.
**Why it happens:** Transaction model was designed for bookings and subscriptions only.
**How to avoid:** Add `productOrderId` (optional FK) to Transaction model in the same migration that creates the ProductOrder table. This allows the payment webhook processor to link MARKETPLACE_SALE transactions to product orders.
**Warning signs:** MARKETPLACE_SALE transactions floating with no order reference, making admin reconciliation impossible.

### Pitfall 8: Webhook Routing for MARKETPLACE_SALE
**What goes wrong:** PaymentWebhookService currently routes all `payment.captured` events to find a Booking by `razorpayOrderId`. Product order payments have no booking -- they need to find a ProductOrder instead.
**Why it happens:** Webhook handler was built for booking-only payments.
**How to avoid:** Use the `notes.type` field in the Razorpay order to route: `BOOKING_COMMISSION` -> existing booking flow, `MARKETPLACE_SALE` -> new product order flow. The order notes are available in the webhook payload (`paymentEntity.notes`).
**Warning signs:** Product order payments marked as FAILED because "no booking found for order".

## Code Examples

### Prisma Schema: Product Models

```prisma
// Source: Pattern derived from existing schema conventions

model ProductCategory {
  id          String    @id @default(uuid()) @db.Uuid
  name        String    @unique @db.VarChar(100)
  slug        String    @unique @db.VarChar(100)
  description String?   @db.Text
  isActive    Boolean   @default(true) @map("is_active")
  sortOrder   Int       @default(0) @map("sort_order")
  parentId    String?   @map("parent_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  parent      ProductCategory?  @relation("ProductCategoryTree", fields: [parentId], references: [id])
  children    ProductCategory[] @relation("ProductCategoryTree")
  products    Product[]

  @@map("product_categories")
}

model Product {
  id                String          @id @default(uuid()) @db.Uuid
  vendorId          String          @map("vendor_id") @db.Uuid
  categoryId        String          @map("category_id") @db.Uuid
  name              String          @db.VarChar(200)
  description       String?         @db.Text
  pricePaise        Int             @map("price_paise")
  stock             Int             @default(0)
  lowStockThreshold Int             @default(5) @map("low_stock_threshold")
  moq               Int             @default(1) // Minimum order quantity
  isActive          Boolean         @default(true) @map("is_active")
  fulfillmentSource String          @default("SUPPLIER") @map("fulfillment_source") @db.VarChar(20) // SUPPLIER | ZEVENTO (for future)
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")

  vendor            VendorProfile   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  category          ProductCategory @relation(fields: [categoryId], references: [id])
  images            ProductImage[]
  orderItems        ProductOrderItem[]

  @@index([vendorId])
  @@index([categoryId])
  @@index([isActive, categoryId])
  @@map("products")
}

model ProductImage {
  id                 String   @id @default(uuid()) @db.Uuid
  productId          String   @map("product_id") @db.Uuid
  cloudinaryPublicId String   @map("cloudinary_public_id") @db.VarChar(255)
  cloudinaryUrl      String   @map("cloudinary_url") @db.Text
  sortOrder          Int      @default(0) @map("sort_order")
  createdAt          DateTime @default(now()) @map("created_at")

  product            Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@map("product_images")
}

model ProductOrder {
  id                String              @id @default(uuid()) @db.Uuid
  buyerId           String              @map("buyer_id") @db.Uuid
  vendorId          String              @map("vendor_id") @db.Uuid
  // status: PENDING | CONFIRMED | DISPATCHED | DELIVERED | CANCELLED
  status            String              @default("PENDING") @db.VarChar(20)
  totalPaise        Int                 @map("total_paise")
  razorpayOrderId   String?             @map("razorpay_order_id") @db.VarChar(50)
  paymentStatus     String?             @map("payment_status") @db.VarChar(20)
  commissionRateBps Int?                @map("commission_rate_bps")
  shippingAddress   String?             @map("shipping_address") @db.Text
  note              String?             @db.Text
  confirmedAt       DateTime?           @map("confirmed_at")
  dispatchedAt      DateTime?           @map("dispatched_at")
  deliveredAt       DateTime?           @map("delivered_at")
  cancelledAt       DateTime?           @map("cancelled_at")
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")

  buyer             User                @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  vendor            VendorProfile       @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  items             ProductOrderItem[]
  statusHistory     OrderStatusHistory[]
  transactions      Transaction[]

  @@index([buyerId])
  @@index([vendorId])
  @@index([status])
  @@map("product_orders")
}

model ProductOrderItem {
  id          String       @id @default(uuid()) @db.Uuid
  orderId     String       @map("order_id") @db.Uuid
  productId   String       @map("product_id") @db.Uuid
  quantity    Int
  unitPaise   Int          @map("unit_paise")
  totalPaise  Int          @map("total_paise")

  order       ProductOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product      @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@map("product_order_items")
}

model OrderStatusHistory {
  id         String       @id @default(uuid()) @db.Uuid
  orderId    String       @map("order_id") @db.Uuid
  fromStatus String?      @map("from_status") @db.VarChar(20)
  toStatus   String       @map("to_status") @db.VarChar(20)
  note       String?      @db.Text
  changedAt  DateTime     @default(now()) @map("changed_at")

  order      ProductOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@map("order_status_history")
}
```

### Shared Enums to Add

```typescript
// Source: Existing enums.ts pattern in packages/shared/src/enums.ts

// Phase 6: B2B Product Marketplace
export enum ProductOrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum FulfillmentSource {
  SUPPLIER = 'SUPPLIER',
  ZEVENTO = 'ZEVENTO',
}
```

### Relation Additions to Existing Models

```prisma
// Add to VendorProfile:
  products        Product[]
  productOrders   ProductOrder[]   @relation("VendorProductOrders")

// Add to User:
  productOrders   ProductOrder[]   @relation("BuyerProductOrders")

// Add to Transaction:
  productOrderId  String?          @map("product_order_id") @db.Uuid
  productOrder    ProductOrder?    @relation(fields: [productOrderId], references: [id], onDelete: SetNull)
  // Add @@index([productOrderId])
```

### Product Search with Pagination (Catalog)

```typescript
// Source: Existing CustomerService.searchVendors pattern
async searchProducts(dto: SearchProductsDto) {
  const page = dto.page ?? 1;
  const limit = dto.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    vendor: {
      status: 'APPROVED',
      subscription: { status: { in: ['ACTIVE', 'AUTHENTICATED'] } },
    },
  };

  if (dto.search) {
    where.name = { contains: dto.search, mode: 'insensitive' };
  }

  if (dto.categoryId) {
    where.categoryId = dto.categoryId;
  }

  if (dto.priceMin !== undefined) {
    where.pricePaise = { ...where.pricePaise as any, gte: dto.priceMin };
  }

  if (dto.priceMax !== undefined) {
    where.pricePaise = { ...where.pricePaise as any, lte: dto.priceMax };
  }

  if (dto.vendorId) {
    where.vendorId = dto.vendorId;
  }

  const [products, total] = await Promise.all([
    this.prisma.product.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        pricePaise: true,
        stock: true,
        moq: true,
        fulfillmentSource: true,
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, businessName: true } },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1, // thumbnail only in list view
          select: { cloudinaryUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.product.count({ where }),
  ]);

  return {
    data: products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
```

### Low-Stock Alert via BullMQ

```typescript
// Source: Existing BullMQ processor pattern from PaymentProcessor
@Processor('stock-alerts')
@Injectable()
export class StockAlertProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { super(); }

  async process(job: Job<{ productId: string; currentStock: number }>) {
    const { productId, currentStock } = job.data;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { vendor: { select: { id: true, userId: true, businessName: true } } },
    });

    if (!product || currentStock > product.lowStockThreshold) return;

    await this.notificationService.sendPushToVendor(product.vendorId, {
      leadId: productId, // reusing interface -- could be refactored
      eventType: `Low stock: ${product.name} (${currentStock} remaining)`,
      city: 'Inventory Alert',
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SELECT FOR UPDATE (raw SQL) | Prisma interactive $transaction + atomic decrement | Prisma 4.7+ (2023) | No need for raw SQL locking; Prisma handles isolation |
| Single file upload per request | FileInterceptor still standard in NestJS 10.x | N/A | FilesInterceptor available but single-file-per-request with loop is simpler pattern |
| Manual webhook routing by orderId | Route by notes.type field in Razorpay order | Project convention from Phase 5 | Enables multi-purpose payment processing |

**Deprecated/outdated:**
- Prisma `$transaction([])` (batch API) for stock operations: Use interactive `$transaction(async (tx) => ...)` instead -- batch API cannot do conditional logic (check stock, then decrement)
- Full-text search via Prisma `search` mode: Still in preview for PostgreSQL. For product name search, `contains` with `mode: 'insensitive'` is sufficient for MVP. Full-text search can be added later via raw SQL + tsvector if needed.

## Open Questions

1. **Product categories: Seed data needed**
   - What we know: Products need categories (Balloons, Ribbons, Tableware, Lights, etc.) separate from event categories
   - What's unclear: Exact category taxonomy for the supplier marketplace
   - Recommendation: Create a ProductCategory model with self-referential parent/child. Seed 8-10 top-level categories matching common event decoration supplies. Admin can manage categories later (same pattern as EventCategory CRUD in admin module).

2. **Multi-vendor cart vs. single-vendor order**
   - What we know: A planner might want products from multiple suppliers in one shopping session
   - What's unclear: Whether orders should span multiple vendors (complex: split payments, multiple fulfillments) or be per-vendor (simpler)
   - Recommendation: **Per-vendor orders** for MVP. Each ProductOrder has exactly one vendorId. If a planner wants items from 3 suppliers, they place 3 separate orders. This avoids payment splitting complexity and aligns with how the payout system works (one transaction per vendor). Multi-vendor cart can be added in a future phase.

3. **Shipping/delivery logistics**
   - What we know: Products are physical goods that need delivery
   - What's unclear: Whether Zevento handles logistics or suppliers self-ship
   - Recommendation: Supplier self-ships for MVP. ProductOrder has a `shippingAddress` field (text). Delivery tracking is manual via status transitions (Dispatched > Delivered). Third-party logistics integration deferred.

4. **Stock restoration timing on cancelled orders**
   - What we know: Stock is decremented at order creation; must be restored on cancellation
   - What's unclear: Should stock restore on CANCELLED only, or also on payment timeout?
   - Recommendation: Restore stock on explicit CANCELLED transition. For payment timeout: add a BullMQ delayed job (e.g., 30 minutes) that auto-cancels unpaid orders and restores stock. This prevents stock lock-up from abandoned orders.

5. **MOQ (Minimum Order Quantity) enforcement**
   - What we know: Original SRS Products table includes MOQ field
   - What's unclear: Whether MOQ is per-order or per-item in a multi-item order
   - Recommendation: MOQ is per-product-per-order-item. If product MOQ is 10, the planner must order at least 10 units of that product. Validate at order creation: `item.quantity >= product.moq`.

## Sources

### Primary (HIGH confidence)
- Prisma schema.prisma -- existing codebase (all models, relations, conventions verified)
- CloudinaryService, RazorpayService, CommissionService, PaymentService, BookingService -- existing implementations read and verified
- VendorOwnerGuard, JwtAuthGuard, RolesGuard -- existing guard patterns verified
- NotificationService -- push notification patterns verified
- packages/shared/src/enums.ts -- TransactionType.MARKETPLACE_SALE already exists
- [Prisma CRUD docs](https://www.prisma.io/docs/orm/prisma-client/queries/crud) -- atomic increment/decrement operations
- [Prisma transactions docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) -- interactive $transaction pattern
- [Prisma filtering docs](https://www.prisma.io/docs/v6/orm/prisma-client/queries/filtering-and-sorting) -- contains with mode insensitive

### Secondary (MEDIUM confidence)
- [Prisma CHECK constraints](https://www.prisma.io/docs/orm/more/troubleshooting/check-constraints) -- custom migration for stock >= 0 constraint
- [Prisma full-text search](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search) -- still preview for PostgreSQL
- [Optimistic locking with Prisma](https://oneuptime.com/blog/post/2026-01-25-optimistic-locking-prisma-nodejs/view) -- Jan 2026 guide on concurrent update handling

### Tertiary (LOW confidence)
- [NestJS e-commerce architecture patterns](https://blog.devgenius.io/architecture-nest-js-ecommerce-series-02-255b13d9769a) -- module structure reference (used for validation, not primary guidance)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven in codebase; zero new dependencies
- Architecture: HIGH -- follows exact patterns from Phases 2-5 (guards, services, controllers, BullMQ processors, webhook routing)
- Pitfalls: HIGH -- derived from reading actual existing code and understanding exact integration points (Transaction model, webhook handler, CommissionService)
- Data model: HIGH -- follows existing Prisma schema conventions (UUID, @map, @@map, @index, relations)
- Stock management: HIGH -- Prisma atomic operations well-documented; $transaction pattern proven in codebase
- Payment integration: HIGH -- identical to Phase 5 booking payment flow, notes.type routing enables multi-purpose webhooks

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days -- stable stack, no fast-moving dependencies)
