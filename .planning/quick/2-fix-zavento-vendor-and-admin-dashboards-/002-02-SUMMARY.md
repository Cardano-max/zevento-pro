---
phase: quick-002
plan: "02"
subsystem: vendor-dashboard-ui
tags:
  - nextjs
  - vendor
  - crud
  - messaging
  - profile
  - services
dependency_graph:
  requires:
    - apps/vendor/src/components/layout.tsx
    - apps/vendor/src/lib/api.ts
    - apps/vendor/src/lib/format.ts
    - api/src/vendor/vendor.service.ts
    - api/src/vendor/vendor.controller.ts
    - api/prisma/schema.prisma
  provides:
    - /services page: vendor service listings CRUD
    - /profile page: extended with 4 new fields + per-section save
    - /inbox page: dual-tab (Leads + Messages) with chat thread + polling
    - Sidebar: Services nav item
    - UpdateBusinessProfileDto: flexible partial update DTO
    - VendorProfile schema: 9 new optional columns
  affects:
    - PATCH /vendor/profile/business now accepts ownerName, phone, tiktokUrl, youtubeUrl, contactEmail, websiteUrl, instagramUrl, facebookUrl, yearsExperience
    - GET /vendor/profile/me now returns all 9 new fields
tech_stack:
  added: []
  patterns:
    - Per-section save buttons (not one save all) for better UX
    - Polling setInterval (10s) for new messages without WebSocket
    - Split-panel chat UI (conversation list + thread) with mobile responsive toggle
    - Inline form (no modal) for service creation
    - Partial update DTO pattern (all fields optional) for PATCH endpoints
key_files:
  created:
    - apps/vendor/src/app/services/page.tsx
    - api/src/vendor/dto/update-business-profile.dto.ts
    - api/prisma/migrations/20260315210000_quick002_02_vendor_profile_fields/migration.sql
  modified:
    - apps/vendor/src/app/profile/page.tsx
    - apps/vendor/src/app/inbox/page.tsx
    - apps/vendor/src/components/sidebar.tsx
    - api/src/vendor/vendor.controller.ts
    - api/src/vendor/vendor.service.ts
    - api/prisma/schema.prisma
decisions:
  - "Created UpdateBusinessProfileDto with all-optional fields instead of reusing CreateProfileDto — PATCH semantics require partial updates, original DTO required categoryIds ArrayMinSize(1)"
  - "Added contactEmail/websiteUrl/instagramUrl/facebookUrl to Prisma schema — these fields were used in the frontend but were missing from VendorProfile model (silently returning null)"
  - "Per-section save buttons instead of one save all — clearer mental model for users, each section (Business Info / Social Links) saves independently to PATCH /vendor/profile/business"
  - "10-second polling for messages instead of WebSocket — sufficient for MVP, no infrastructure required"
  - "Services sidebar item placed after Inbox, uses Layers icon from lucide-react — matches plan spec"
  - "Split-panel chat layout with md:flex responsive breakpoint — full-width on mobile, split on desktop"
metrics:
  duration: "22 min"
  completed: "2026-03-15"
  tasks_completed: 4
  files_changed: 9
---

# Phase Quick-002 Plan 02: Vendor Services Management + Profile Fixes + Messaging Inbox Summary

**One-liner:** New /services CRUD page, extended profile form with owner name/phone/TikTok/YouTube, and dual-tab inbox with real-time customer messaging via split-panel chat UI.

## What Was Built

### Task 1: Vendor Services Page (NEW)
- `apps/vendor/src/app/services/page.tsx` — fully new 'use client' page
- Lists services in 3-col card grid (1 col mobile, 2 sm, 3 lg)
- Each card: title, category badge (emerald), description (line-clamp-2), formatted price, active/inactive badge
- Actions: Deactivate/Activate toggle, Delete with confirmation dialog
- Inline "New Service" form (no modal) at top: title, category select (from /customer/categories), description, price in rupees (converted to paise), price type select
- Empty state with "Add Your First Service" CTA
- Toast notifications (success/error, auto-dismiss 4s)
- Parallel fetch: `Promise.all([GET /vendor/services, GET /customer/categories])` on mount

### Task 2: Sidebar Update
- Added `{ label: 'Services', href: '/services', icon: Layers }` after Inbox entry
- Imported `Layers` from lucide-react

### Task 3: Profile Page Extended
- Added 4 new form fields: Owner Name (User icon), Phone (Phone icon), TikTok (Video icon, pink), YouTube (Youtube icon, red)
- Existing fields Contact Email, Website URL preserved
- Reorganized into two separate save forms: "Business Information" and "Social Media Links"
- Each section has its own Save button calling PATCH /vendor/profile/business
- Interface extended with ownerName, phone, tiktokUrl, youtubeUrl

### Task 4: Inbox Messages Tab
- Added main tab switcher: "Lead Assignments" | "Messages"
- Leads tab: all existing behavior preserved (filter tabs, accept/decline/quote forms)
- Messages tab: split-panel layout
  - Left: conversation list (customer name/phone, last message preview, timestamp)
  - Right: chat thread with bubbles (VENDOR right+emerald, CUSTOMER left+slate)
  - Compose textarea + Send button (Enter key sends, Shift+Enter newline)
  - 10-second polling via setInterval for new messages
  - Auto-scroll to latest message via ref
  - Mobile: shows list OR thread (toggle via back button)
- Empty state: message when no conversations yet

### Backend Changes
- `UpdateBusinessProfileDto` — all-optional PATCH DTO replacing required `CreateProfileDto` for the PATCH /vendor/profile/business endpoint
- `VendorProfile` Prisma schema — added 9 new nullable columns: contactEmail, websiteUrl, instagramUrl, facebookUrl, yearsExperience, ownerName, phone, tiktokUrl, youtubeUrl
- `vendor.service.ts updateBusinessDetails` — rebuilt to use UpdateBusinessProfileDto with conditional field inclusion pattern
- Migration SQL created at `api/prisma/migrations/20260315210000_quick002_02_vendor_profile_fields/migration.sql`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CreateProfileDto required categoryIds making PATCH /vendor/profile/business broken**
- **Found during:** Task 3 (profile page analysis)
- **Issue:** The existing profile page sent businessName/description/contactEmail etc. to PATCH /vendor/profile/business, but CreateProfileDto had `@ArrayMinSize(1) categoryIds: string[]` as a required field — this would reject all profile saves
- **Fix:** Created `UpdateBusinessProfileDto` with all fields optional, updated controller to use it, rebuilt `updateBusinessDetails` to conditionally update only provided fields
- **Files modified:** api/src/vendor/dto/update-business-profile.dto.ts (created), api/src/vendor/vendor.controller.ts, api/src/vendor/vendor.service.ts

**2. [Rule 2 - Missing Fields] contactEmail, websiteUrl, instagramUrl, facebookUrl not in Prisma schema**
- **Found during:** Task 3 (schema investigation)
- **Issue:** VendorProfile model in schema.prisma had NO contactEmail, websiteUrl, instagramUrl, facebookUrl fields — these were used in the frontend profile page but the API would always return null for them and silently ignore them on save
- **Fix:** Added all 9 profile fields to VendorProfile schema (contactEmail, websiteUrl, instagramUrl, facebookUrl, yearsExperience, ownerName, phone, tiktokUrl, youtubeUrl) — created migration SQL since local DB is unavailable (Render hosted)
- **Files modified:** api/prisma/schema.prisma, migration SQL created

## Self-Check: PASSED

Files exist:
- FOUND: apps/vendor/src/app/services/page.tsx
- FOUND: apps/vendor/src/app/profile/page.tsx
- FOUND: apps/vendor/src/app/inbox/page.tsx
- FOUND: apps/vendor/src/components/sidebar.tsx
- FOUND: api/src/vendor/dto/update-business-profile.dto.ts
- FOUND: api/prisma/migrations/20260315210000_quick002_02_vendor_profile_fields/migration.sql

Build verification:
- `npx tsc --noEmit` in apps/vendor: 0 errors
- `npx tsc --noEmit` in api: 0 errors
- `npm run build` in apps/vendor: SUCCESS (all 13 pages including /services compiled)
- `npx prisma generate` in api: SUCCESS (Prisma client regenerated with new fields)
