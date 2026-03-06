---
status: testing
phase: 02-vendor-onboarding-subscriptions
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md
started: 2026-03-06T12:00:00Z
updated: 2026-03-06T12:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: API Server Starts and Seed Data Loads
expected: |
  Run `cd api && pnpm prisma migrate dev && pnpm prisma db seed && pnpm start:dev`.
  Server starts on port 3000 without errors. Seed data loads (2 markets, 2 categories, 4 subscription plans).
awaiting: user response

## Tests

### 1. API Server Starts and Seed Data Loads
expected: Run `cd api && pnpm prisma migrate dev && pnpm prisma db seed && pnpm start:dev`. Server starts on port 3000 without errors. Seed data loads successfully.
result: [pending]

### 2. Vendor Profile Creation (Step 2)
expected: After logging in as a PLANNER user (use OTP flow from Phase 1), call `POST /vendor/profile/business` with businessName, categories, pricingMin, pricingMax. Returns profile with onboardingStep advanced to 2. Calling `GET /vendor/profile` shows the saved profile with status DRAFT.
result: [pending]

### 3. Portfolio Photo Upload (Step 3)
expected: Call `POST /vendor/profile/photos` with a multipart form file upload (any image). Returns photo record with cloudinaryUrl (mock URL in dev mode). Calling `GET /vendor/profile/photos` shows the uploaded photo(s).
result: [pending]

### 4. Service Area Selection (Step 4)
expected: Call `PUT /vendor/profile/service-areas` with a market ID (from seed data) and radiusKm. Returns success. Profile onboardingStep advances to 4.
result: [pending]

### 5. KYC Document Upload and Submission (Step 5)
expected: Call `POST /vendor/profile/kyc/documents` with document file and type (AADHAAR or PAN for planner). Then call `POST /vendor/profile/kyc/submit`. Profile status changes to PENDING_KYC. An AdminNotification record is created.
result: [pending]

### 6. Subscription Plan Listing
expected: Call `GET /subscriptions/plans` (authenticated as vendor). Returns subscription plans filtered by vendor's role (PLANNER plans if logged in as planner). Each plan shows name, tier, amountPaise, and features.
result: [pending]

### 7. Subscription Checkout
expected: Call `POST /subscriptions/checkout` with a planId. Returns a checkout URL (mock URL in dev mode). A VendorSubscription record is created with status CREATED.
result: [pending]

### 8. Admin KYC Review
expected: As ADMIN user, call `GET /admin/vendors?status=PENDING_KYC`. Returns the vendor who submitted KYC. Call `POST /admin/vendors/:id/kyc-review` with action APPROVE. Vendor status changes to APPROVED. AdminNotification is created for the review action.
result: [pending]

### 9. Admin Category Management
expected: As ADMIN, call `POST /admin/categories` with name "Wedding Decoration". Returns category with auto-generated slug. Call `GET /admin/categories` shows the new category alongside seeded ones. Call `PATCH /admin/categories/:id` to update name. Call `DELETE /admin/categories/:id` or toggle isActive to disable.
result: [pending]

### 10. Admin Subscription Plan Management
expected: As ADMIN, call `GET /admin/subscription-plans`. Returns all 4 seeded plans with subscription counts. Call `PATCH /admin/subscription-plans/:id` to update amountPaise. The razorpayPlanId resets to null (forcing re-creation on next checkout).
result: [pending]

### 11. Admin Notifications
expected: As ADMIN, call `GET /admin/notifications/unread-count`. Returns count of unread notifications (should include KYC submission notification from test 5). Call `GET /admin/notifications` to list them. Call `PATCH /admin/notifications/:id/read` to mark one as read.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
