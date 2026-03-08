-- Phase 4: Vendor CRM and Booking Flow
-- Adds: Quote, QuoteLineItem, Booking, BookingStatusHistory, Review, BlockedDate
-- Extends: VendorStats (totalReviewCount), Lead (quotes, booking relations), User (bookings, reviews), VendorProfile (quotes, bookings, blockedDates, reviews)

-- Add totalReviewCount to vendor_stats
ALTER TABLE "vendor_stats" ADD COLUMN "total_review_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: quotes
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "total_paise" INTEGER NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: quote_line_items
CREATE TABLE "quote_line_items" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bookings
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'BOOKED',
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: booking_status_history
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reviews
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "vendor_response" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable: blocked_dates
CREATE TABLE "blocked_dates" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: quotes unique and regular indexes
CREATE UNIQUE INDEX "quotes_lead_id_vendor_id_key" ON "quotes"("lead_id", "vendor_id");
CREATE INDEX "quotes_lead_id_idx" ON "quotes"("lead_id");
CREATE INDEX "quotes_vendor_id_idx" ON "quotes"("vendor_id");
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex: quote_line_items
CREATE INDEX "quote_line_items_quote_id_idx" ON "quote_line_items"("quote_id");

-- CreateIndex: bookings
CREATE UNIQUE INDEX "bookings_lead_id_key" ON "bookings"("lead_id");
CREATE UNIQUE INDEX "bookings_quote_id_key" ON "bookings"("quote_id");
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");
CREATE INDEX "bookings_vendor_id_idx" ON "bookings"("vendor_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex: booking_status_history
CREATE INDEX "booking_status_history_booking_id_idx" ON "booking_status_history"("booking_id");

-- CreateIndex: reviews
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");
CREATE INDEX "reviews_vendor_id_idx" ON "reviews"("vendor_id");
CREATE INDEX "reviews_customer_id_idx" ON "reviews"("customer_id");

-- CreateIndex: blocked_dates
CREATE UNIQUE INDEX "blocked_dates_vendor_id_date_key" ON "blocked_dates"("vendor_id", "date");
CREATE INDEX "blocked_dates_vendor_id_idx" ON "blocked_dates"("vendor_id");

-- AddForeignKey: quotes -> leads
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: quotes -> vendor_profiles
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: quote_line_items -> quotes
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: bookings -> leads
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: bookings -> quotes
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: bookings -> users (customer)
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: bookings -> vendor_profiles
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: booking_status_history -> bookings
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: reviews -> bookings
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: reviews -> users (customer)
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: reviews -> vendor_profiles
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: blocked_dates -> vendor_profiles
ALTER TABLE "blocked_dates" ADD CONSTRAINT "blocked_dates_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
