-- Phase 5: Payments and Commission Settlement
-- Schema evolution for booking payments, commission rates, and vendor payouts

-- 1. Create commission_rates table
CREATE TABLE "commission_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID,
    "vendor_role" VARCHAR(20),
    "rate_bps" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("id")
);

-- 2. Modify transactions table: make vendor_subscription_id optional, add new columns, widen type
ALTER TABLE "transactions" ALTER COLUMN "vendor_subscription_id" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "type" TYPE VARCHAR(30);
ALTER TABLE "transactions" ADD COLUMN "booking_id" UUID;
ALTER TABLE "transactions" ADD COLUMN "commission_paise" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "net_payout_paise" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "razorpay_order_id" VARCHAR(50);
ALTER TABLE "transactions" ADD COLUMN "razorpay_payout_id" VARCHAR(50);
ALTER TABLE "transactions" ADD COLUMN "payout_status" VARCHAR(20);

-- Change vendorSubscription FK to SetNull instead of Cascade
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_vendor_subscription_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vendor_subscription_id_fkey"
    FOREIGN KEY ("vendor_subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Modify bookings table: add payment tracking fields
ALTER TABLE "bookings" ADD COLUMN "razorpay_order_id" VARCHAR(50);
ALTER TABLE "bookings" ADD COLUMN "payment_status" VARCHAR(20);
ALTER TABLE "bookings" ADD COLUMN "commission_rate_bps" INTEGER;

-- 4. Modify vendor_profiles table: add bank account fields
ALTER TABLE "vendor_profiles" ADD COLUMN "bank_account_name" VARCHAR(200);
ALTER TABLE "vendor_profiles" ADD COLUMN "bank_account_number" VARCHAR(30);
ALTER TABLE "vendor_profiles" ADD COLUMN "bank_ifsc" VARCHAR(11);

-- 5. Add indexes
CREATE INDEX "commission_rates_category_id_vendor_role_idx" ON "commission_rates"("category_id", "vendor_role");
CREATE INDEX "transactions_booking_id_idx" ON "transactions"("booking_id");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- 6. Add foreign keys
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Seed default commission rate (5% = 500 bps, global default)
INSERT INTO commission_rates (id, category_id, vendor_role, rate_bps, effective_from)
VALUES (gen_random_uuid(), NULL, NULL, 500, NOW());
