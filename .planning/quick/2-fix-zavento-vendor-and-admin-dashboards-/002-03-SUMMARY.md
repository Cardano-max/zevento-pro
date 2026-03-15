---
phase: quick-002
plan: "03"
subsystem: customer-web-app
tags: [vendor-detail, messaging, calendar, inbox, services]
dependency_graph:
  requires: [quick-002-01]
  provides: [vendor-services-ui, vendor-availability-calendar, customer-direct-messaging, inbox-messages-tab]
  affects: [apps/web/src/app/vendors/[id]/page.tsx, apps/web/src/app/inbox/page.tsx]
tech_stack:
  added: []
  patterns: [read-only-calendar, two-tab-inbox, optimistic-message-update, graceful-api-fallback]
key_files:
  modified:
    - apps/web/src/app/vendors/[id]/page.tsx
    - apps/web/src/app/inbox/page.tsx
    - apps/web/src/lib/types.ts
decisions:
  - "Used Omit<Vendor, 'services'|'blockedDates'> on VendorDetail to avoid type conflict with base Vendor type's VendorService[] shape vs the API's raw response shape (pricePaise, images, category object)"
  - "Availability calendar stored as Array<{date,reason?}> in VendorDetail; AvailabilityCalendar component renders current month with prev/next nav"
  - "Messages tab in inbox falls back gracefully when /customer/conversations returns 404; shows 'Browse Vendors' CTA instead"
  - "Direct message send uses optimistic UI (appends message to local state immediately after POST succeeds)"
metrics:
  duration: "25 min"
  completed: "2026-03-15"
  tasks_completed: 4
  files_modified: 3
---

# Quick-002 Plan 03: Vendor Detail Services, Availability & Messaging Summary

**One-liner:** Vendor detail page now shows service cards with collapsible packages, a read-only month-grid availability calendar, and a direct message form backed by POST /customer/messages/:vendorId; inbox gains a second Messages tab.

## What Was Built

### Task 1: Services & Packages Section (vendor detail page)

Added a "Services & Packages" grid between the About section and Stats grid. Each service renders as a card with:
- Category badge, title, description (line-clamped)
- Price label that adapts to `priceType`: FIXED shows price, STARTING_FROM shows "Starting from ₹X", CUSTOM_QUOTE shows "Custom Quote" in amber
- Collapsible packages list triggered by a "N packages" toggle button
- Each package shows name, price, "Popular" badge if `isPopular=true`, description, and a feature checklist with CircleCheck icons
- Section only renders when `vendor.services` is non-empty and filtered to active services (`isActive !== false`)

### Task 2: Availability Calendar (vendor detail page)

Added `AvailabilityCalendar` component rendered in a dedicated section below Services:
- Month grid with day-of-week headers (Su Mo Tu We Th Fr Sa)
- ChevronLeft/Right navigation between months
- Past dates: gray text
- Blocked dates (from `vendor.blockedDates[]`): red-100 background, red-600 text
- Available future dates: emerald-50 background, emerald-700 text
- Legend row at bottom (Available / Unavailable)
- Section only renders when `vendor.blockedDates` is present (handles undefined gracefully)

### Task 3: Direct Message Card (vendor detail sidebar)

Added "Direct Message" card above the AI Planner promo block:
- Unauthenticated: shows "Login to Message" button → redirects to `/login?redirect=/vendors/:id`
- Authenticated (collapsed): "Send Message" button → reveals textarea
- Authenticated (expanded): textarea + Send/Cancel buttons; POST `/customer/messages/:id` with `{body}`
- On success: confirmation UI with CircleCheck icon + "Send another" link to reset

### Task 4: Inbox Messages Tab

Enhanced `/inbox` page with a two-tab layout:
- Tab 1 "Inquiries": original inquiry list preserved exactly
- Tab 2 "Messages": `MessagesTab` component that:
  - Tries GET `/customer/conversations` to list conversations
  - If endpoint returns 404: shows "Start a conversation from any vendor profile" empty state
  - If conversations exist: renders clickable conversation list (vendor name, last message, unread badge)
  - On conversation click: renders `MessageThread` with full message history from GET `/customer/messages/:vendorId`
  - Compose input at bottom with Enter-to-send; optimistic message append on success
  - If `?conv=vendorId` in URL: auto-opens that conversation (supports redirect from vendor page)

### Task 5: Types (types.ts)

Added:
- `VendorPackage` interface (id, name, description, priceInPaise, features, isPopular)
- `VendorService` interface (id, title, description, category, basePrice, priceType, imageUrls, isActive, packages)
- Extended `Vendor` base interface with `services?: VendorService[]` and `blockedDates?: string[]`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type conflict between Vendor.services and VendorDetail.services**
- **Found during:** Task 1 TypeScript check
- **Issue:** `VendorDetail extends Vendor` but redefined `services` with a different shape (`pricePaise`, `images`, `category` as object) incompatible with `Vendor.services?: VendorService[]`
- **Fix:** Changed `VendorDetail extends Vendor` to `VendorDetail extends Omit<Vendor, 'services' | 'blockedDates'>` and defined a local `ApiService` interface matching the actual API response shape
- **Files modified:** `apps/web/src/app/vendors/[id]/page.tsx`
- **Commit:** 5540fc3

**2. [Rule 2 - Enhancement] Added graceful fallback for missing /customer/conversations endpoint**
- **Found during:** Task 2 inbox implementation (API only has per-vendor GET, no list endpoint)
- **Issue:** Plan noted this as a possible gap; confirmed: no conversation list endpoint exists
- **Fix:** MessagesTab catches the 404 and shows "Start a conversation from any vendor profile" empty state with Browse Vendors CTA
- **Files modified:** `apps/web/src/app/inbox/page.tsx`

## Self-Check: PASSED

Files exist:
- FOUND: apps/web/src/app/vendors/[id]/page.tsx
- FOUND: apps/web/src/app/inbox/page.tsx
- FOUND: apps/web/src/lib/types.ts

Commits:
- FOUND: 5540fc3

Build: Next.js build completed with 0 TypeScript errors, 0 build errors.
