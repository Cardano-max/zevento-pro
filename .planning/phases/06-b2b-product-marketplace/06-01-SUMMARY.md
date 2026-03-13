---
phase: 06-b2b-product-marketplace
plan: "01"
subsystem: product
tags: [product, catalog, inventory, cloudinary, bullmq, prisma, stock-alerts]
dependency_graph:
  requires:
    - "05-01: CloudinaryService with uploadImage/deleteImage and dev mock mode"
    - "05-01: VendorOwnerGuard attaches req.vendorId"
    - "02-01: VendorProfile with PLANNER and SUPPLIER roles"
    - "01-02: JwtAuthGuard, RolesGuard"
  provides:
    - "GET /catalog/products — paginated product search (public, filtered by category/price/search/vendorId)"
    - "GET /catalog/products/:id — product detail with images, category, vendor info"
    - "GET /catalog/categories — list active product categories"
    - "POST /vendor/products — create product (SUPPLIER only)"
    - "PATCH /vendor/products/:id — update product (SUPPLIER owner)"
    - "DELETE /vendor/products/:id — delete product with Cloudinary cascade (SUPPLIER owner)"
    - "POST /vendor/products/:id/images — upload product image via Cloudinary (SUPPLIER owner)"
    - "DELETE /vendor/products/:id/images/:imageId — delete product image (SUPPLIER owner)"
    - "PATCH /vendor/products/:id/stock — manually adjust stock (SUPPLIER owner)"
    - "StockAlertProcessor — BullMQ worker sends push to vendor when stock <= lowStockThreshold"
  affects:
    - "Phase 6 Plan 02: ProductOrder model available; Product.stock available for atomic decrement"
tech_stack:
  added: []
  patterns:
    - "ProductModule imports CloudinaryModule, NotificationModule, VendorModule, BullModule.registerQueue('stock-alerts')"
    - "UpdateProductDto: explicit optional fields (no PartialType — @nestjs/mapped-types not installed)"
    - "Product ownership check: product.vendorId === req.vendorId before any mutation"
    - "Cloudinary cascade delete: loop ProductImage records, delete each via cloudinaryService, then delete product"
    - "Stock alert: after adjustStock, if currentStock <= lowStockThreshold, queue BullMQ job"
key_files:
  created:
    - api/src/product/product.service.ts
    - api/src/product/product.controller.ts
    - api/src/product/product.module.ts
    - api/src/product/catalog.service.ts
    - api/src/product/catalog.controller.ts
    - api/src/product/dto/create-product.dto.ts
    - api/src/product/dto/update-product.dto.ts
    - api/src/product/dto/search-products.dto.ts
    - api/src/product/processor/stock-alert.processor.ts
  modified:
    - api/prisma/schema.prisma
    - packages/shared/src/enums.ts
    - api/prisma/seed.ts
    - api/src/app.module.ts
key-decisions:
  - "[06-01]: UpdateProductDto uses explicit optional fields (not PartialType) — @nestjs/mapped-types not installed in this project"
  - "[06-01]: Cloudinary cascade delete on product — loop images, delete each from Cloudinary, then Prisma cascade handles DB records"
  - "[06-01]: CatalogController is public (no class-level auth) — browse endpoints need no auth"
  - "[06-01]: ProductCategory seeded with 8 top-level event supply categories (Balloons, Ribbons, Tableware, etc.)"
metrics:
  duration_seconds: 1245
  tasks_completed: 2
  files_created: 9
  files_modified: 4
  completed_date: "2026-03-13"
---

# Phase 6 Plan 01: B2B Product Schema + ProductModule + Catalog — Summary

**Full product catalog infrastructure: 6 new Prisma models, ProductModule with SUPPLIER-guarded CRUD and Cloudinary image management, public CatalogService for planner browsing/search, and BullMQ low-stock alert processor.**

## Performance

- **Duration:** ~21 min (1245 seconds — includes rate limit interruption)
- **Tasks:** 2
- **Files modified:** 13 total (9 created, 4 modified)

## Accomplishments

- Prisma schema: ProductCategory (self-referential hierarchy), Product, ProductImage, ProductOrder, ProductOrderItem, OrderStatusHistory, Transaction.productOrderId FK, PostgreSQL CHECK constraint (stock >= 0)
- ProductModule: full SUPPLIER-guarded CRUD (create/update/delete with Cloudinary cascade), image upload/delete, manual stock adjust, BullMQ stock-alert queue
- CatalogModule: public paginated product search (category/price/name/vendorId filters), product detail, category listing
- StockAlertProcessor: sends push notification to vendor when stock falls at or below threshold
- Shared enums: ProductOrderStatus, FulfillmentSource
- 8 product category seeds: Balloons, Ribbons & Decorations, Tableware, Lights & Candles, Event Furniture, Backdrop & Draping, Floral Supplies, Party Favors & Gifts

## Task Commits

1. **Task 1: Schema + enums + seed** - `0426c9e` (feat)
2. **Task 2: ProductModule + CatalogModule** - `62d5a25` (feat)

## Files Created/Modified

- `api/prisma/schema.prisma` — 6 new models + Transaction.productOrderId
- `packages/shared/src/enums.ts` — ProductOrderStatus, FulfillmentSource
- `api/prisma/seed.ts` — 8 product category seeds
- `api/src/product/product.service.ts` — CRUD, image management, stock operations
- `api/src/product/product.controller.ts` — SUPPLIER-guarded endpoints
- `api/src/product/product.module.ts` — Module wiring
- `api/src/product/catalog.service.ts` — Public search with pagination and filters
- `api/src/product/catalog.controller.ts` — Public browse endpoints
- `api/src/product/dto/*.ts` — CreateProductDto, UpdateProductDto, SearchProductsDto
- `api/src/product/processor/stock-alert.processor.ts` — BullMQ low-stock alert

## Decisions Made

- `UpdateProductDto` uses explicit optional fields (not `PartialType`) because `@nestjs/mapped-types` is not installed in this project — discovered via build error, fixed inline
- Catalog controller is fully public at class level (no UseGuards) — product browsing requires no auth, consistent with vendor storefront pattern
- Cloudinary images are cascade-deleted when a product is removed — loop ProductImage records, call cloudinaryService.deleteImage for each, then let Prisma onDelete: Cascade handle DB records

## Deviations from Plan

- `UpdateProductDto` replaced `PartialType(CreateProductDto)` with explicit optional fields due to missing `@nestjs/mapped-types` dependency. Same validation coverage, no functional difference.

## Next Phase Readiness

Plan 06-02 (OrderModule + payment) is unblocked. All product models, ProductService, and CatalogService are available.

---
*Phase: 06-b2b-product-marketplace*
*Completed: 2026-03-13*
