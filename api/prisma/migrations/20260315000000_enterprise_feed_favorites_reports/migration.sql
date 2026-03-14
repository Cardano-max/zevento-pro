-- Phase 07.2: Enterprise Extension
-- Feed Posts, Feed Comments, Favorite Vendors, Reports

-- Add Phase 07.2 relations to User model (no SQL needed, handled by FK below)

-- CreateTable feed_posts
CREATE TABLE "feed_posts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_role" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200),
    "body" TEXT NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    "media_urls" JSONB,
    "city" VARCHAR(100),
    "event_date" TIMESTAMP(3),
    "budget_paise" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable feed_comments
CREATE TABLE "feed_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable favorite_vendors
CREATE TABLE "favorite_vendors" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable reports
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_posts_author_id_idx" ON "feed_posts"("author_id");
CREATE INDEX "feed_posts_status_created_at_idx" ON "feed_posts"("status", "created_at" DESC);
CREATE INDEX "feed_posts_category_idx" ON "feed_posts"("category");

-- CreateIndex
CREATE INDEX "feed_comments_post_id_idx" ON "feed_comments"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_vendors_customer_id_vendor_id_key" ON "favorite_vendors"("customer_id", "vendor_id");
CREATE INDEX "favorite_vendors_customer_id_idx" ON "favorite_vendors"("customer_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "feed_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
