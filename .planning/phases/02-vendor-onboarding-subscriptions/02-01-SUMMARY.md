---
phase: 02-vendor-onboarding-subscriptions
plan: 01
subsystem: api
tags: [prisma, postgis, cloudinary, nestjs, multer, vendor-onboarding, kyc]

requires:
  - phase: 01-foundation
    provides: "User model, UserRole table, Market table, JwtAuthGuard, RolesGuard, CurrentUser decorator, PrismaModule"
provides:
  - "All Phase 2 Prisma models (VendorProfile, EventCategory, VendorCategory, PortfolioPhoto, VendorServiceArea, KycDocument, SubscriptionPlan, VendorSubscription, Transaction, AdminNotification)"
  - "CloudinaryService for image upload/delete with dev mock fallback"
  - "Vendor progressive onboarding API (Steps 2-5)"
  - "VendorOwnerGuard for profile access control"
  - "PostGIS-enabled Docker postgres image"
  - "Seed data: 2 markets with lat/lng, 2 event categories, 4 subscription plans"
affects: [02-02-subscription-billing, 02-03-admin-kyc, 03-lead-routing]

tech-stack:
  added: [cloudinary, streamifier, multer, postgis]
  patterns: [progressive-onboarding-steps, max-step-pattern, vendor-owner-guard, cloudinary-mock-dev]

key-files:
  created:
    - api/prisma/seed.ts
    - api/src/cloudinary/cloudinary.module.ts
    - api/src/cloudinary/cloudinary.service.ts
    - api/src/cloudinary/cloudinary.provider.ts
    - api/src/vendor/vendor.module.ts
    - api/src/vendor/vendor.controller.ts
    - api/src/vendor/vendor.service.ts
    - api/src/vendor/dto/create-profile.dto.ts
    - api/src/vendor/dto/update-portfolio.dto.ts
    - api/src/vendor/dto/update-service-area.dto.ts
    - api/src/vendor/dto/submit-kyc.dto.ts
    - api/src/vendor/guards/vendor-owner.guard.ts
    - api/.env.example
  modified:
    - api/prisma/schema.prisma
    - docker-compose.yml
    - packages/shared/src/enums.ts
    - api/src/app.module.ts
    - api/src/main.ts
    - api/package.json

key-decisions:
  - "PostGIS image is backward-compatible drop-in; no existing queries affected"
  - "onboardingStep uses max(current, N) so vendors can revisit earlier steps without losing progress"
  - "Cloudinary returns mock data in dev mode when env vars not set — prevents blocking development"
  - "VendorOwnerGuard attaches vendorId to request object rather than using route params — simpler controller signatures"
  - "All amounts stored in paise (not rupees) — consistent with Phase 1 decision pattern"

patterns-established:
  - "Progressive onboarding: onboardingStep = max(current, N) pattern for non-linear step completion"
  - "VendorOwnerGuard: find profile by userId, attach vendorId to req, ADMIN bypasses"
  - "Cloudinary dev mock: return placeholder data when env vars missing in development"
  - "File upload: FileInterceptor with memoryStorage, file type filter, 10MB limit"

duration: 13min
completed: 2026-03-06
---

# Phase 2 Plan 1: Vendor Onboarding Summary

**PostGIS-ready schema with 10 new models, Cloudinary upload service, and full vendor progressive onboarding API (Steps 2-5: business details, portfolio photos, service areas, KYC submission)**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-05T23:38:47Z
- **Completed:** 2026-03-05T23:51:51Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments
- All Phase 2 Prisma models migrated with PostGIS-enabled Docker image and seed data (2 markets, 2 categories, 4 subscription plans)
- CloudinaryService with upload/delete and automatic dev mock fallback when credentials not configured
- Full vendor onboarding API: 10 endpoints covering profile creation, business details, portfolio photos, service areas, KYC documents, and KYC submission with admin notification

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, Docker, and shared enums** - `e67a2da` (feat)
2. **Task 2: Cloudinary upload module** - `9d4f26f` (feat)
3. **Task 3: Vendor progressive onboarding API** - `2cd41fe` (feat)

## Files Created/Modified
- `api/prisma/schema.prisma` - Added 10 new models for Phase 2 (VendorProfile through AdminNotification), lat/lng on Market, vendorProfile on User
- `api/prisma/seed.ts` - Seeds markets with coordinates, event categories, and subscription plans
- `docker-compose.yml` - Switched to postgis/postgis:16-3.4-alpine
- `packages/shared/src/enums.ts` - OnboardingStep, VendorStatus, KycDocumentType, SubscriptionTier, SubscriptionStatus, TransactionType, TransactionStatus, AdminNotificationType
- `api/src/cloudinary/cloudinary.module.ts` - Global module providing CloudinaryService
- `api/src/cloudinary/cloudinary.service.ts` - Upload/delete with Cloudinary v2, dev mock fallback
- `api/src/cloudinary/cloudinary.provider.ts` - Configures Cloudinary from env vars
- `api/src/vendor/vendor.module.ts` - VendorModule with controller, service, guard
- `api/src/vendor/vendor.controller.ts` - 10 endpoints for progressive onboarding (Steps 2-5)
- `api/src/vendor/vendor.service.ts` - Business logic for all onboarding operations
- `api/src/vendor/dto/*.ts` - DTOs with class-validator for all endpoints
- `api/src/vendor/guards/vendor-owner.guard.ts` - Ensures vendor owns profile, ADMIN bypasses
- `api/src/app.module.ts` - Added CloudinaryModule and VendorModule imports
- `api/src/main.ts` - Enabled rawBody for future webhook support
- `api/.env.example` - All required env vars documented

## Decisions Made
- PostGIS image is backward-compatible drop-in replacement; no existing queries affected
- onboardingStep uses max(current, N) pattern so vendors can revisit earlier steps without losing progress
- Cloudinary returns mock data in dev mode when env vars not set, preventing development blockage
- VendorOwnerGuard attaches vendorId to request object rather than relying on route params
- Rejected vendors can re-edit and re-submit (status resets to DRAFT on business detail update)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added multer runtime dependency**
- **Found during:** Task 3 (Vendor controller with FileInterceptor)
- **Issue:** `multer` package not installed as runtime dependency; `@nestjs/platform-express` requires it but does not bundle it in newer versions
- **Fix:** `pnpm add multer`
- **Files modified:** api/package.json, pnpm-lock.yaml
- **Verification:** API starts successfully, all routes mapped
- **Committed in:** `2cd41fe` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for FileInterceptor to work at runtime. No scope creep.

## Issues Encountered
- Docker was not running at start of execution; opened Docker Desktop and waited for daemon before proceeding with migration

## User Setup Required

Cloudinary credentials are optional for development (mock mode returns placeholder data). For production or real image uploads:
- `CLOUDINARY_CLOUD_NAME` - from Cloudinary Dashboard > Settings
- `CLOUDINARY_API_KEY` - from Cloudinary Dashboard > Settings
- `CLOUDINARY_API_SECRET` - from Cloudinary Dashboard > Settings

## Next Phase Readiness
- All Phase 2 database models in place for 02-02 (subscription billing) and 02-03 (admin KYC review)
- VendorService exported for use by subscription and admin modules
- SubscriptionPlan seed data ready for Razorpay plan creation in 02-02
- AdminNotification table ready for admin dashboard in 02-03

---
*Phase: 02-vendor-onboarding-subscriptions*
*Completed: 2026-03-06*
