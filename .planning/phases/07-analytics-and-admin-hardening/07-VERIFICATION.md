---
phase: 07-analytics-and-admin-hardening
verified: 2026-03-13T11:00:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 7: Analytics and Admin Hardening Verification Report

**Phase Goal:** Admins have full visibility into platform health and lead flow; the platform is instrumented for expansion beyond Surat and Ahmedabad with market density gates and routing override controls
**Verified:** 2026-03-13T11:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

#### Plan 07-01: Analytics Dashboard

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /admin/analytics/dashboard returns data reflecting the last 24 hours by default | VERIFIED | `admin.service.ts:882-885` computes `since = Date.now() - 24h` when no dateFrom provided; controller wired at line 291 |
| 2 | Response includes leadsPerCity array with city name and lead count | VERIFIED | `admin.service.ts:889-893` runs `prisma.lead.groupBy({ by: ['city'] })` and maps to `{ city, count }` at line 930-933 |
| 3 | Response includes conversionFunnel array ordered PENDING through CANCELLED (8 stages) | VERIFIED | `admin.service.ts:870-879` defines `FUNNEL_ORDER` with all 8 statuses; lines 914-920 normalize via Map with zero-fill |
| 4 | Response includes revenueByStream array with type, count, totalAmountPaise per transaction type | VERIFIED | `admin.service.ts:900-905` runs `prisma.transaction.groupBy({ by: ['type'] })` on PAID; mapped at 922-926 |
| 5 | Response includes activeVendorCount integer (APPROVED + ACTIVE/AUTHENTICATED subscription) | VERIFIED | `admin.service.ts:906-911` uses `prisma.vendorProfile.count` with correct filter |
| 6 | Response includes window object with from and to timestamps | VERIFIED | `admin.service.ts:929` returns `{ window: { from: since, to: until }, ... }` |
| 7 | Endpoint is protected by JwtAuthGuard + RolesGuard requiring ADMIN role | VERIFIED | `admin.controller.ts:31-32` applies `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('ADMIN')` at controller level |

#### Plan 07-02: Lead Routing Audit, Override, and Market Status

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | Every Mode B routing event (routeTopThree) produces LeadRoutingTrace rows | VERIFIED | `routing.service.ts:197-210` calls `leadRoutingTrace.createMany` with all scored vendors, `selected=true/false`, `skipReason` |
| 9 | Every Mode A routing event (routeDirect) produces a single LeadRoutingTrace row | VERIFIED | `routing.service.ts:54-63` calls `leadRoutingTrace.create` with `score: null, scoreFactors: {}, selected: true` |
| 10 | GET /admin/leads/:leadId/routing-trace returns all trace rows with vendor businessName | VERIFIED | `admin.service.ts:949-952` uses `leadRoutingTrace.findMany` with `include: { vendor: { select: { id, businessName } } }` |
| 11 | PATCH /admin/leads/:leadId/routing-override cancels PENDING/NOTIFIED and creates new assignment | VERIFIED | `admin.service.ts:977-1013` runs Prisma transaction: updateMany to CANCELLED, create new assignment, upsert trace |
| 12 | Override on BOOKED/COMPLETED/CANCELLED returns 400 BadRequest | VERIFIED | `admin.service.ts:971-975` checks `['BOOKED','COMPLETED','CANCELLED'].includes(lead.status)` and throws BadRequestException |
| 13 | GET /admin/markets returns all Market records with id, city, state, status | VERIFIED | `admin.service.ts:1036-1045` uses `prisma.market.findMany` with `select: { id, city, state, status, launchDate }` |
| 14 | PATCH /admin/markets/:marketId/status updates market status | VERIFIED | `admin.service.ts:1048-1065` validates market exists, then `prisma.market.update` with `dto.status` |
| 15 | ScoringService.findVendorsInRange only returns vendors whose market has status ACTIVE | VERIFIED | `scoring.service.ts:92` and `scoring.service.ts:111` both have `AND m.status = 'ACTIVE'` in raw SQL |

**Score:** 15/15 truths verified

### Required Artifacts

#### Plan 07-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/admin/dto/analytics-query.dto.ts` | Optional dateFrom/dateTo with IsDateString | VERIFIED | 11 lines, has `@IsOptional()` + `@IsDateString()` on both fields |
| `api/src/admin/admin.service.ts` | getAnalyticsDashboard() with Prisma groupBy in Promise.all | VERIFIED | Lines 881-938, four Prisma calls in `Promise.all`, proper normalization |
| `api/src/admin/admin.controller.ts` | GET /admin/analytics/dashboard endpoint | VERIFIED | Line 290-293, `@Get('analytics/dashboard')` with AnalyticsQueryDto |

#### Plan 07-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/prisma/schema.prisma` | LeadRoutingTrace model, Lead.routingTraces relation, VendorProfile.routingTraces relation, Lead @@index([createdAt]) | VERIFIED | Model at line 656-676, relations at lines 139/345, index at line 350 |
| `api/prisma/migrations/20260313200000_phase7_lead_routing_trace/migration.sql` | Migration SQL for lead_routing_traces table | VERIFIED | 37 lines, creates table, indexes, foreign keys, leads.created_at index |
| `api/src/lead/scoring.service.ts` | scoreVendors returns factors; findVendorsInRange gates on ACTIVE | VERIFIED | Return type includes `factors: VendorScoreFactors` (line 209); both SQL queries gate on `m.status = 'ACTIVE'` |
| `api/src/routing/routing.service.ts` | routeTopThree writes trace rows; routeDirect writes single trace row | VERIFIED | createMany at line 198; create at line 54 |
| `api/src/admin/dto/routing-override.dto.ts` | RoutingOverrideDto with vendorId (IsUUID) and optional reason | VERIFIED | 10 lines, `@IsUUID()` on vendorId, `@IsOptional() @IsString()` on reason |
| `api/src/admin/dto/market-status.dto.ts` | MarketStatusDto with IsIn validator | VERIFIED | 6 lines, `@IsIn(['PLANNED','ACTIVE','PAUSED','DECOMMISSIONED'])` |
| `api/src/admin/admin.service.ts` | getLeadRoutingTrace, overrideRouting, listMarkets, updateMarketStatus | VERIFIED | All four methods present (lines 944-1065), with proper error handling |
| `api/src/admin/admin.controller.ts` | Four new endpoints for routing trace, override, markets | VERIFIED | Lines 299-328: GET routing-trace, PATCH routing-override, GET markets, PATCH markets/:id/status |
| `api/src/admin/admin.module.ts` | NotificationModule imported | VERIFIED | Line 3 imports, line 10 in `imports` array |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| admin.controller.ts | admin.service.ts | getAnalyticsDashboard() call | WIRED | Line 292 calls `this.adminService.getAnalyticsDashboard(query)` |
| admin.service.ts | prisma.lead.groupBy | Prisma groupBy on Lead model | WIRED | Lines 889-898, two `prisma.lead.groupBy` calls (leadsPerCity, funnel) |
| admin.service.ts | prisma.transaction.groupBy | Prisma groupBy on Transaction model | WIRED | Lines 900-905, `prisma.transaction.groupBy` for revenue |
| routing.service.ts | prisma.leadRoutingTrace.createMany | After LeadAssignment creation in routeTopThree | WIRED | Lines 198-210, after assignment loop (lines 185-194) |
| scoring.service.ts | scoreVendors return type | factors included in returned objects | WIRED | Lines 208-209: return type `Array<{ vendorId, score, factors }>`, line 215 returns `{ vendorId, score, factors }` |
| scoring.service.ts | findVendorsInRange raw SQL | AND m.status = 'ACTIVE' filter | WIRED | Line 92 (with categoryId) and line 111 (without) both have the gate |
| admin.service.ts | prisma.leadRoutingTrace.findMany | getLeadRoutingTrace query | WIRED | Lines 949-953, findMany with include vendor.businessName |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| ADMIN-03: Admin can view lead flow, routing results, and manually override routing | SATISFIED | None -- routing trace (GET /admin/leads/:leadId/routing-trace) and override (PATCH /admin/leads/:leadId/routing-override) endpoints verified |
| ADMIN-05: Admin can view analytics dashboard (leads/city, conversions, revenue, active vendors) | SATISFIED | None -- GET /admin/analytics/dashboard returns all four metric groups with configurable time window |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

No TODO/FIXME/PLACEHOLDER comments found. No empty implementations. No console.log-only handlers. No stub returns.

### Commit Verification

All four task commits verified in git history:
- `049bc1a` -- feat(07-01): add AnalyticsQueryDto and getAnalyticsDashboard service method
- `2069d76` -- feat(07-01): wire GET /admin/analytics/dashboard endpoint
- `b2ab29e` -- feat(07-02): add LeadRoutingTrace schema, scoring factors, and trace writes
- `82adfe2` -- feat(07-02): add admin routing audit, override, and market status endpoints

### TypeScript Compilation

`npx tsc --noEmit` passes with zero errors.

### Human Verification Required

### 1. Analytics Dashboard Data Accuracy

**Test:** With a running server and seeded data, call `GET /admin/analytics/dashboard` and verify the response shape matches `{ window, leadsPerCity, conversionFunnel, revenueByStream, activeVendorCount }`.
**Expected:** `window.from` is approximately 24 hours before `window.to`; `conversionFunnel` has exactly 8 entries in FUNNEL_ORDER; `revenueByStream` groups by PAID transaction type.
**Why human:** Requires running database with realistic data to verify aggregation accuracy.

### 2. Routing Override Flow

**Test:** Create a lead in ROUTED status, call `PATCH /admin/leads/:leadId/routing-override` with a valid vendorId, verify old PENDING/NOTIFIED assignments are cancelled and new assignment is created.
**Expected:** Response `{ success: true, leadId, overrideVendorId }`. Previous assignments status changed to CANCELLED. Push notification sent to new vendor.
**Why human:** Requires running server with active database and notification service.

### 3. Market Status Gate in Routing

**Test:** Set a market to PAUSED, then submit a lead for that market's city. Verify no vendors from the paused market are returned by findVendorsInRange.
**Expected:** Vendors in PAUSED market are excluded from routing. Setting market back to ACTIVE re-includes them.
**Why human:** Requires running database with PostGIS and market/vendor data to verify raw SQL filter.

### Gaps Summary

No gaps found. All 15 observable truths verified against actual codebase. All artifacts exist, are substantive (not stubs), and are properly wired. Key links between controller-service-Prisma are confirmed. Both raw SQL queries in ScoringService gate on market status. TypeScript compiles cleanly. No anti-patterns detected.

---

_Verified: 2026-03-13T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
