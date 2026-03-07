-- Enable PostGIS extension for geospatial queries (ST_DWithin, ST_MakePoint)
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "vendor_stats" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "response_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "total_leads_received" INTEGER NOT NULL DEFAULT 0,
    "total_leads_won" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "budget" INTEGER NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "target_vendor_id" UUID,
    "category_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "consent_log_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "score" DOUBLE PRECISION,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "notified_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_stats_vendor_id_key" ON "vendor_stats"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_stats_vendor_id_idx" ON "vendor_stats"("vendor_id");

-- CreateIndex
CREATE INDEX "leads_customer_id_idx" ON "leads"("customer_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_category_id_idx" ON "leads"("category_id");

-- CreateIndex
CREATE INDEX "lead_assignments_vendor_id_idx" ON "lead_assignments"("vendor_id");

-- CreateIndex
CREATE INDEX "lead_assignments_status_idx" ON "lead_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignments_lead_id_vendor_id_key" ON "lead_assignments"("lead_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "vendor_stats" ADD CONSTRAINT "vendor_stats_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_target_vendor_id_fkey" FOREIGN KEY ("target_vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
