-- Quick-002-02: Extended vendor profile fields
-- Adds contact info, social media, and owner fields to vendor_profiles

ALTER TABLE "vendor_profiles"
  ADD COLUMN IF NOT EXISTS "contact_email"  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "website_url"    TEXT,
  ADD COLUMN IF NOT EXISTS "instagram_url"  TEXT,
  ADD COLUMN IF NOT EXISTS "facebook_url"   TEXT,
  ADD COLUMN IF NOT EXISTS "years_experience" INTEGER,
  ADD COLUMN IF NOT EXISTS "owner_name"     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "phone"          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "tiktok_url"     TEXT,
  ADD COLUMN IF NOT EXISTS "youtube_url"    TEXT;
