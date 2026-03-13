-- Phase 6: B2B Product Marketplace
-- 6 new tables, indexes, FKs, and Transaction.productOrderId FK

-- CreateTable: product_categories
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: products
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fulfillment_source" VARCHAR(20) NOT NULL DEFAULT 'SUPPLIER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_images
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "cloudinary_public_id" VARCHAR(255) NOT NULL,
    "cloudinary_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_orders
CREATE TABLE "product_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "total_paise" INTEGER NOT NULL,
    "razorpay_order_id" VARCHAR(50),
    "payment_status" VARCHAR(20),
    "commission_rate_bps" INTEGER,
    "shipping_address" TEXT,
    "note" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_order_items
CREATE TABLE "product_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,

    CONSTRAINT "product_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: order_status_history
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- AlterTable: transactions — add product_order_id FK
ALTER TABLE "transactions" ADD COLUMN "product_order_id" UUID;

-- CreateIndex: unique constraints
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex: performance indexes
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");
CREATE INDEX "products_vendor_id_idx" ON "products"("vendor_id");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
CREATE INDEX "products_is_active_category_id_idx" ON "products"("is_active", "category_id");
CREATE INDEX "product_orders_buyer_id_idx" ON "product_orders"("buyer_id");
CREATE INDEX "product_orders_vendor_id_idx" ON "product_orders"("vendor_id");
CREATE INDEX "product_orders_status_idx" ON "product_orders"("status");
CREATE INDEX "product_order_items_order_id_idx" ON "product_order_items"("order_id");
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");
CREATE INDEX "transactions_product_order_id_idx" ON "transactions"("product_order_id");

-- AddForeignKey: product_categories self-referential
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: products
ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: product_images
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: product_orders
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: product_order_items
ALTER TABLE "product_order_items" ADD CONSTRAINT "product_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "product_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_order_items" ADD CONSTRAINT "product_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: order_status_history
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "product_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: transactions.product_order_id
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_product_order_id_fkey" FOREIGN KEY ("product_order_id") REFERENCES "product_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defense-in-depth: stock cannot go negative
ALTER TABLE "products" ADD CONSTRAINT "stock_non_negative" CHECK ("stock" >= 0);
