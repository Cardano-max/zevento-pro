-- Quick-002: VendorService CRUD + Conversation + Message schema
-- Run via: psql $DATABASE_URL -f migration.sql
-- Or applied automatically on Render API redeploy via prisma db push

-- ─────────────────────────────────────────────────────────────
-- CreateTable: vendor_services
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "vendor_services" (
    "id"          UUID         NOT NULL,
    "vendor_id"   UUID         NOT NULL,
    "title"       VARCHAR(200) NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER      NOT NULL,
    "category_id" UUID,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "images"      JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_services_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "vendor_services_vendor_id_idx"  ON "vendor_services"("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_services_is_active_idx"  ON "vendor_services"("is_active");

-- Foreign keys
ALTER TABLE "vendor_services"
    ADD CONSTRAINT "vendor_services_vendor_id_fkey"
        FOREIGN KEY ("vendor_id")  REFERENCES "vendor_profiles"("id") ON DELETE CASCADE;

ALTER TABLE "vendor_services"
    ADD CONSTRAINT "vendor_services_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- CreateTable: conversations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "conversations" (
    "id"          UUID         NOT NULL,
    "customer_id" UUID         NOT NULL,
    "vendor_id"   UUID         NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- Unique constraint (one conversation per customer-vendor pair)
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_customer_id_vendor_id_key"
    ON "conversations"("customer_id", "vendor_id");

-- Indexes
CREATE INDEX IF NOT EXISTS "conversations_customer_id_idx" ON "conversations"("customer_id");
CREATE INDEX IF NOT EXISTS "conversations_vendor_id_idx"   ON "conversations"("vendor_id");

-- Foreign keys
ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- CreateTable: messages
-- ─────────────────────────────────────────────────────────────
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

-- Index on conversationId + createdAt for message history queries
CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx"
    ON "messages"("conversation_id", "created_at");

-- Foreign keys
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_sender_id_fkey"
        FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE;
