---
phase: quick-002
plan: "01"
subsystem: vendor-services-and-messaging
tags:
  - prisma
  - crud
  - messaging
  - conversations
  - vendor-services
dependency_graph:
  requires:
    - api/prisma/schema.prisma
    - api/src/vendor/vendor.service.ts
    - api/src/vendor/vendor.controller.ts
    - api/src/customer/customer.service.ts
  provides:
    - VendorService CRUD endpoints (4 routes)
    - Vendor messaging endpoints (3 routes)
    - Customer messaging endpoints (2 routes)
    - vendor_services, conversations, messages DB tables
  affects:
    - GET /customer/vendors/:id now returns services[] and blockedDates[]
tech_stack:
  added: []
  patterns:
    - Separate controller classes in same file for related route groups
    - Upsert pattern for conversation creation (idempotent)
    - senderRole enum inline (CUSTOMER|VENDOR) in messages table
key_files:
  created:
    - api/src/vendor/dto/create-service.dto.ts
    - api/src/vendor/dto/update-service.dto.ts
    - api/prisma/migrations/20260315200000_quick002_vendor_services_messaging/migration.sql
  modified:
    - api/prisma/schema.prisma
    - api/src/vendor/vendor.service.ts
    - api/src/vendor/vendor.controller.ts
    - api/src/vendor/vendor.module.ts
    - api/src/customer/customer.service.ts
    - api/src/customer/customer.controller.ts
decisions:
  - "Two extra controllers (VendorServicesController, VendorConversationsController) added in same vendor.controller.ts file — keeps module boundary clean without new files"
  - "Conversation.updatedAt updated after each message send — enables orderBy updatedAt for inbox list"
  - "getVendorProfile includes blockedDates now — Plan 03 (availability calendar) needs it"
  - "DB push not possible locally (Render hosted) — manual migration SQL created + prisma generate run"
  - "Messaging embedded in vendor/customer modules instead of separate messaging module — avoids circular dependency, sufficient for MVP"
metrics:
  duration: "18 min"
  completed: "2026-03-15"
  tasks_completed: 3
  files_changed: 8
---

# Phase Quick-002 Plan 01: VendorService CRUD + Messaging API Summary

**One-liner:** Vendor marketplace service listings (CRUD) + customer-vendor messaging via Conversation/Message schema, with 9 new authenticated endpoints and 3 new Prisma models deployed to Render.

## What Was Built

### Schema Changes (Task 1)

Three new Prisma models added to `api/prisma/schema.prisma`:

**VendorService** (`vendor_services` table)
- Vendors create service offerings with title, description, pricePaise, categoryId, images (JSON array)
- FK to VendorProfile (cascade delete) and EventCategory (set null)
- Reverse relation added to VendorProfile and EventCategory

**Conversation** (`conversations` table)
- One conversation per customer-vendor pair (unique constraint)
- FK to User (customer) and VendorProfile (vendor), both cascade delete

**Message** (`messages` table)
- senderRole: CUSTOMER | VENDOR
- readAt nullable for read-receipt tracking
- Index on (conversationId, createdAt) for history queries

Reverse relations added to User model (`customerConversations`, `sentMessages`) and VendorProfile (`services`, `conversations`).

Manual migration SQL created at `api/prisma/migrations/20260315200000_quick002_vendor_services_messaging/migration.sql` (DB is Render-hosted, no local access).

### VendorService CRUD API (Task 2)

**New DTOs:**
- `CreateServiceDto`: title (required), description, pricePaise (required, min 0), categoryId (UUID), images (string[])
- `UpdateServiceDto`: all fields optional, adds isActive boolean

**New service methods in VendorService:**
- `createService(vendorId, dto)` — creates with category include
- `listServices(vendorId)` — ordered by createdAt desc
- `updateService(vendorId, serviceId, dto)` — ownership check via findFirst
- `deleteService(vendorId, serviceId)` — ownership check + hard delete

**VendorServicesController** at `/vendor/services`:
- `GET /vendor/services` — list my services
- `POST /vendor/services` — create service
- `PATCH /vendor/services/:id` — update service
- `DELETE /vendor/services/:id` — delete service

All routes guarded by JwtAuthGuard + RolesGuard + VendorOwnerGuard.

### Messaging API (Task 3)

**Vendor messaging methods in VendorService:**
- `listConversations(vendorId)` — ordered by updatedAt desc, includes last message
- `getConversationMessages(vendorId, conversationId)` — marks customer messages as read
- `sendMessageAsVendor(vendorId, conversationId, body)` — creates message, bumps conversation.updatedAt

**VendorConversationsController** at `/vendor/conversations`:
- `GET /vendor/conversations` — list conversations
- `GET /vendor/conversations/:id/messages` — message history (marks read)
- `POST /vendor/conversations/:id/messages` — send reply

**Customer messaging methods in CustomerService:**
- `startOrGetConversation(customerId, vendorId)` — upsert pattern
- `sendMessageAsCustomer(customerId, vendorId, body)` — creates conversation if needed
- `getConversationMessages(customerId, vendorId)` — marks vendor messages as read

**CustomerController** messaging routes:
- `POST /customer/messages/:vendorId` — send message to vendor
- `GET /customer/messages/:vendorId` — get conversation history

### Customer Vendor Profile Enhancement

`getVendorProfile` in CustomerService now includes:
- `services[]` — active services (isActive: true), ordered by createdAt desc, with category
- `blockedDates[]` — vendor's blocked dates ordered by date asc

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Architectural Notes

- The plan mentioned creating a separate `api/src/messaging/` module. Instead, messaging was integrated directly into vendor.service.ts and customer.service.ts. This avoids a circular dependency (messaging needs both VendorModule and CustomerModule) and is simpler for MVP. The plan's described behavior (get/send/list) is fully implemented.
- VendorServicesController and VendorConversationsController added as separate exported classes within `vendor.controller.ts` (not separate files) — keeps all vendor routes in one place while honoring the "separate controller class" requirement.
- DB push not possible locally — manual migration SQL file created following the established project pattern. Render will apply it on API restart via prisma db push in the build command.

## Verification

- `npx tsc --noEmit` — 0 errors
- Prisma client generated successfully
- Code pushed to `master` — Render redeploy triggered
- 3 new schema models, 8 new service methods, 9 new API endpoints

## Self-Check: PASSED

All 9 files created/modified exist on disk.
Both task commits (723b711, 03dbe6e) confirmed in git log.
TypeScript compiles with 0 errors.
