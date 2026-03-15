-- Quick-002: VendorService + VendorPackage + Conversation + Message schema
-- All statements idempotent (IF NOT EXISTS / DO NOTHING guards)

CREATE TABLE IF NOT EXISTS "vendor_services" (
    "id"          UUID         NOT NULL,
    "vendor_id"   UUID         NOT NULL,
    "title"       VARCHAR(200) NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER      NOT NULL DEFAULT 0,
    "category_id" UUID,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "images"      JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_packages" (
    "id"           UUID         NOT NULL,
    "service_id"   UUID         NOT NULL,
    "name"         VARCHAR(100) NOT NULL,
    "description"  TEXT,
    "price_paise"  INTEGER      NOT NULL DEFAULT 0,
    "features"     JSONB,
    "is_popular"   BOOLEAN      NOT NULL DEFAULT false,
    CONSTRAINT "vendor_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversations" (
    "id"          UUID         NOT NULL,
    "customer_id" UUID         NOT NULL,
    "vendor_id"   UUID         NOT NULL,
    "last_msg"    TEXT,
    "last_msg_at" TIMESTAMP(3),
    "unread_cust" INTEGER      NOT NULL DEFAULT 0,
    "unread_vend" INTEGER      NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messages" (
    "id"              UUID         NOT NULL,
    "conversation_id" UUID         NOT NULL,
    "sender_id"       UUID         NOT NULL,
    "sender_role"     VARCHAR(20)  NOT NULL,
    "body"            TEXT         NOT NULL,
    "read_at"         TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendor_services_vendor_id_idx" ON "vendor_services"("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_services_is_active_idx" ON "vendor_services"("is_active");
CREATE INDEX IF NOT EXISTS "vendor_packages_service_id_idx" ON "vendor_packages"("service_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_customer_vendor_key" ON "conversations"("customer_id", "vendor_id");
CREATE INDEX IF NOT EXISTS "conversations_customer_id_idx" ON "conversations"("customer_id");
CREATE INDEX IF NOT EXISTS "conversations_vendor_id_idx" ON "conversations"("vendor_id");
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages"("conversation_id", "created_at");

DO $$ BEGIN ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "vendor_packages" ADD CONSTRAINT "vendor_packages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "vendor_services"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conversations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
