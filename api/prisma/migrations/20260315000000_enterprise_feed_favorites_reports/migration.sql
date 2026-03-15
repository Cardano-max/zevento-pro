-- Phase 07.2: Enterprise Extension
-- Feed Posts, Feed Comments, Favorite Vendors, Reports
-- All statements idempotent (IF NOT EXISTS / DO NOTHING guards)

CREATE TABLE IF NOT EXISTS "feed_posts" (
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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feed_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feed_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "favorite_vendors" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorite_vendors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reports" (
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

CREATE INDEX IF NOT EXISTS "feed_posts_author_id_idx" ON "feed_posts"("author_id");
CREATE INDEX IF NOT EXISTS "feed_posts_status_created_at_idx" ON "feed_posts"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "feed_posts_category_idx" ON "feed_posts"("category");
CREATE INDEX IF NOT EXISTS "feed_comments_post_id_idx" ON "feed_comments"("post_id");
CREATE UNIQUE INDEX IF NOT EXISTS "favorite_vendors_customer_id_vendor_id_key" ON "favorite_vendors"("customer_id", "vendor_id");
CREATE INDEX IF NOT EXISTS "favorite_vendors_customer_id_idx" ON "favorite_vendors"("customer_id");
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
CREATE INDEX IF NOT EXISTS "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

DO $$ BEGIN ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "reports" ADD CONSTRAINT "reports_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "feed_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
