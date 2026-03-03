# Stack Research

**Domain:** Multi-sided event marketplace (lead generation + service booking + B2B product marketplace)
**Researched:** 2026-03-04
**Confidence:** MEDIUM — Context7 and WebFetch unavailable in this session; findings drawn from training knowledge (cutoff August 2025) plus known ecosystem patterns. All version numbers flagged individually. Verify before pinning in package.json.

---

## Research Constraints

Context7 MCP and WebFetch tools were denied in this session. All findings below are based on:
- Training data (cutoff August 2025) — flagged as LOW or MEDIUM confidence unless widely established
- Known official documentation patterns
- Cross-validated ecosystem knowledge from multiple sources in training

**Action required before dev starts:** Verify all version numbers at npmjs.com or official docs. Versions marked with `*` are from training data only.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Next.js | 15.x* | Full-stack web framework (frontend + API routes) | App Router + Server Components reduce client bundle; built-in API routes eliminate need for separate Express server; ISR for planner listing pages; deployed to Vercel with zero config. Web-first strategy maps perfectly to Next.js. | MEDIUM |
| TypeScript | 5.x* | Type safety across full codebase | Marketplace platforms have complex data models (Lead, Vendor, Score, Assignment, Subscription, Order). TypeScript eliminates a class of bugs at the interfaces between modules. Indian dev ecosystem has strong TypeScript fluency. | HIGH |
| PostgreSQL | 16.x* | Primary relational database | Marketplace data is relational: Users → Vendors → Leads → Assignments → Bookings → Payments → Orders. Referential integrity is critical — a lead that references a deleted vendor must be handled correctly. PostgreSQL's JSONB covers flexible vendor profile fields without schema churn. | HIGH |
| Prisma ORM | 5.x* | Database access layer | Type-safe queries that match TypeScript models; auto-generates DB client from schema; migrations built-in; works with PostgreSQL and can add read replicas later. Alternative (Drizzle) is faster but less mature for team onboarding. | MEDIUM |
| Redis | 7.x* | Caching + session store + real-time pub/sub + job queues | Vendor scoring algorithm needs sub-millisecond reads on frequently accessed scores. OTP tokens must expire (Redis TTL is perfect). BullMQ job queues for lead routing async jobs. Socket.IO adapter for horizontal scaling. | HIGH |
| Node.js | 22.x LTS* | JavaScript runtime | Next.js runs on Node; BullMQ and Firebase Admin SDK are Node-native. Consistency across frontend and backend reduces context switching. | HIGH |

### Backend Services

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| BullMQ | 5.x* | Async job queue (lead routing, notifications, subscription renewal) | Lead routing must be non-blocking — customer submits form, gets immediate confirmation, routing happens async. BullMQ on Redis handles retries, priorities, delayed jobs, and dead letter queues. Preferred over simple `setTimeout` or AWS SQS for self-hosted deployment. | MEDIUM |
| Socket.IO | 4.x* | Real-time vendor dashboard notifications | Vendors must see new lead assignments instantly. Socket.IO handles WebSocket with long-poll fallback, works with Next.js custom server, scales horizontally via Redis adapter. For v1 (500 vendors), single instance is fine. | MEDIUM |
| Firebase Admin SDK | 12.x* | Push notifications to web + mobile PWA | Project spec mandates Firebase push. Admin SDK runs server-side, sends FCM messages to vendor devices. Does not require Firebase Firestore — just FCM for push. | MEDIUM |
| node-cron | 3.x* | Scheduled jobs (subscription renewals, lead expiry, fairness rotation reset) | Lightweight cron for scheduled tasks that don't need the full BullMQ worker model. Subscription plan check at midnight, fairness rotation weight reset weekly. | MEDIUM |

### Authentication

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| NextAuth.js (Auth.js) | 5.x* | Session management after OTP verification | Auth.js v5 (beta → stable in 2025) supports custom credentials provider, which wraps the OTP verification flow. Manages JWT sessions, refresh tokens, role-based session data. Do NOT use Auth.js for OTP delivery — it is session management only. | MEDIUM |
| MSG91 or Fast2SMS | API-based | OTP SMS delivery (India) | MSG91 is the dominant Indian OTP provider used by major platforms (Meesho, Urban Company). Reliable DLT registration support required by TRAI. Fast2SMS is cheaper but less reliable at scale. Use MSG91 for v1. | LOW (single-source from training) |
| Custom OTP logic | — | 6-digit OTP generation + Redis TTL expiry | Generate OTP server-side, store hashed OTP in Redis with 10-minute TTL, verify on submit. Do not store in PostgreSQL — it creates unnecessary row churn. Standard pattern across Indian startups. | HIGH (pattern is well-established) |

### Payment Processing

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Razorpay Node.js SDK | 2.x* | Primary payment gateway | Indian market requirement. Razorpay supports: subscriptions (recurring billing for vendor plans), payment links, orders API, payouts (vendor commission disbursement), webhooks. Single SDK covers all 4 revenue models: subscriptions, lead purchase, booking commission, marketplace margin. | MEDIUM |
| Razorpay Subscriptions | — | Vendor monthly plan billing (Rs.12,000/mo, Rs.36,000/mo) | Native recurring billing with automatic retry on failure, pause/resume, proration. Avoids building subscription state machine manually. | MEDIUM |
| Razorpay Payouts | — | Vendor commission disbursement | When booking commission is collected, Razorpay Payouts API disburses to vendor bank accounts. Requires RazorpayX business account. | LOW (verify RazorpayX eligibility for new business) |

### Frontend

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| React | 19.x* | UI component model | Ships with Next.js 15; Server Components reduce JavaScript sent to browser (critical for Indian mobile networks). | HIGH |
| Tailwind CSS | 4.x* | Utility-first styling | Fastest styling approach for marketplace UIs with many variants (vendor cards, lead status badges, subscription tier indicators). Tailwind v4 uses CSS-native approach — verify v4 stability before adopting; v3.4 is a safe fallback. | MEDIUM |
| shadcn/ui | 0.x (no version — copy-paste model) | Accessible component library | Copy-paste components (no npm package version lock). Radix UI primitives underneath. Use for admin panel, vendor CRM dashboards, data tables. Does not ship a bundle — components live in your codebase. | HIGH |
| React Hook Form | 7.x* | Form state management | Lead creation forms, vendor registration multi-step, quote generator. RHF has minimal re-renders, built-in validation with Zod integration, handles file uploads for portfolio images. | HIGH |
| Zod | 3.x* | Runtime schema validation | Define schemas once, use on both client (form validation) and server (API input validation). Critical for lead form data integrity — invalid city, missing consent flag must be caught at API boundary. | HIGH |
| TanStack Query (React Query) | 5.x* | Server state management | Vendor dashboard needs real-time data (leads, bookings). React Query handles caching, background refetch, optimistic updates. Use with Next.js App Router's server-side data fetching where possible; TanStack Query for client-interactive data. | HIGH |
| TanStack Table | 8.x* | Data tables in admin + vendor CRM | Lead assignment tables, order management, vendor approval queues. TanStack Table is headless — style with Tailwind/shadcn. | MEDIUM |
| Recharts | 2.x* | Analytics charts | Vendor dashboard (leads received, conversion rate, booking value) and admin dashboard (leads per city, revenue tracking). Recharts is React-native, simpler than Chart.js for React codebases. | MEDIUM |

### File Storage

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Cloudinary or AWS S3 | API-based | Vendor portfolio images, product catalog images, documents | Marketplace platforms need image optimization (WebP conversion, resize on-the-fly). Cloudinary free tier is sufficient for v1 (500 vendors); migrate to S3 + CloudFront at scale. Cloudinary has Indian CDN PoPs. | MEDIUM |

### Infrastructure

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Vercel | — | Next.js hosting (frontend + API routes) | Zero-config Next.js deployment, edge middleware for auth, ISR for listing pages, preview deployments for QA. For 500–5,000 vendors, Vercel Pro tier is cost-effective. At 30,000 vendors and 10,000 leads/day, re-evaluate to self-hosted or Railway. | MEDIUM |
| Neon or Supabase Postgres | — | Managed PostgreSQL | Serverless Postgres with connection pooling (critical for Vercel serverless functions which cannot maintain persistent connections). Neon scales to zero when idle. For v1, either works; Neon has better Vercel integration via official Vercel Postgres (which runs on Neon). | MEDIUM |
| Upstash Redis | — | Managed Redis (serverless-compatible) | Serverless Redis with HTTP API — compatible with Vercel Edge Functions. Handles OTP storage, BullMQ (via @upstash/qstash as alternative), caching. At scale, replace with self-hosted Redis cluster. | MEDIUM |
| Railway | — | Alternative self-hosted option for Node workers | BullMQ workers and Socket.IO server cannot run on Vercel (no persistent processes). Deploy worker services to Railway or Render. Railway supports Node.js with persistent processes, environment variables, Postgres, Redis as services. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint + eslint-config-next | Lint Next.js code | Catches React hooks rules, import ordering. Use with eslint-plugin-unicorn for stricter rules. |
| Prettier | Code formatting | Consistent formatting across team. Configure with .prettierrc. |
| Husky + lint-staged | Pre-commit hooks | Run ESLint + Prettier on staged files before commit. Prevents bad code reaching main. |
| Vitest | Unit + integration tests | Jest-compatible, faster, native ESM support. Test vendor scoring algorithm, lead routing logic, OTP verification. |
| Playwright | E2E browser tests | Test lead form submission → lead creation → vendor notification flow end-to-end. |
| Docker Compose | Local development environment | Run PostgreSQL + Redis locally matching production configuration. Eliminates "works on my machine" for DB state. |
| pnpm | Package manager | Faster installs, strict dependency resolution, workspace support if monorepo. Replace npm/yarn. |

---

## Installation

```bash
# Initialize Next.js 15 with TypeScript, Tailwind, App Router
pnpm create next-app@latest zevento-web --typescript --tailwind --app --src-dir --import-alias "@/*"

# Core production dependencies
pnpm add prisma @prisma/client
pnpm add @auth/core next-auth
pnpm add bullmq ioredis
pnpm add socket.io
pnpm add firebase-admin
pnpm add razorpay
pnpm add zod react-hook-form @hookform/resolvers
pnpm add @tanstack/react-query @tanstack/react-table
pnpm add recharts
pnpm add node-cron
pnpm add axios  # for internal API calls in server actions

# shadcn/ui (interactive installer)
pnpm dlx shadcn@latest init

# Dev dependencies
pnpm add -D vitest @vitejs/plugin-react playwright
pnpm add -D eslint prettier husky lint-staged
pnpm add -D @types/node @types/react @types/react-dom

# Initialize Prisma
pnpm prisma init --datasource-provider postgresql
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative | Why We Don't Use It Here |
|-------------|-------------|-------------------------|--------------------------|
| Next.js 15 (full-stack) | Separate React SPA + Express/NestJS API | Large teams with dedicated backend engineers (5+); microservices from day one | Adds deployment complexity, CORS configuration, two separate repos. For 2-person frontend + 2-person backend, a Next.js monolith ships faster and is easier to maintain in v1. |
| PostgreSQL | MongoDB | Truly schema-less data (content management, logs) | Marketplace data is fundamentally relational. Lead → Assignment → Vendor relationships require joins. MongoDB's flexibility becomes a liability when you need referential integrity for financial data (payments, commissions). |
| Prisma | Drizzle ORM | Performance-critical query paths, green team comfortable with SQL | Drizzle is faster and type-safe, but requires more manual SQL knowledge. Prisma's codegen accelerates onboarding for a team that may be junior. Drizzle is the right next step at Phase 3. |
| BullMQ | AWS SQS | Cloud-native AWS deployment with managed queue | BullMQ on Redis is simpler to run locally, cheaper at small scale, and avoids AWS vendor lock-in at v1. At 10,000 leads/day (Phase 3), evaluate SQS or Google Pub/Sub. |
| Razorpay | Cashfree, PayU, CCAvenue | Budget constraints (Cashfree has lower per-transaction fees) | Razorpay has the best developer experience, most complete API (subscriptions + payouts in one SDK), and superior documentation. PayU and CCAvenue have poor webhook reliability reports. |
| MSG91 | Twilio | Global SMS needs | Twilio is more expensive in India and has worse DLT compliance support. MSG91 is built for Indian TRAI DLT requirements and has better delivery rates on Airtel/Jio/BSNL. |
| Vercel + Railway | AWS EC2 / GCP VMs | Full infrastructure control, cost at massive scale | EC2/GCP requires DevOps expertise. At 500–5,000 vendors, managed platforms cost less than a DevOps engineer's time. Migrate at Phase 3 when infra cost exceeds ~$2,000/month. |
| Tailwind v4 | Tailwind v3.4 | If v4 stability is uncertain at project start | Tailwind v4 uses a new CSS-native engine. If the team reports instability, pin to v3.4 which is production-proven. |
| Auth.js v5 | Clerk, Supabase Auth | Managed auth with UI components | Clerk and Supabase Auth don't support Indian OTP providers natively without custom provider setup. Auth.js v5 credentials provider is more flexible. Clerk adds $25+/mo cost. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Firebase Firestore as primary DB | NoSQL is wrong for marketplace financial data. Lead → Payment → Commission chains require ACID transactions and referential integrity. Firestore's eventual consistency model creates phantom leads. | PostgreSQL + Prisma |
| Firebase Authentication | Does not support Indian OTP providers (MSG91, Fast2SMS) natively. Forces phone auth through Firebase which has poor DLT compliance. | Auth.js credentials + MSG91 |
| Express.js standalone server | Adds a separate deployment, CORS complexity, and routing boilerplate. Next.js App Router API routes eliminate this for v1. | Next.js API routes / Route Handlers |
| Sequelize ORM | Outdated, poor TypeScript support, verbose migrations. Developer experience is significantly worse than Prisma. | Prisma |
| Redux for state management | Overkill for this app. Most state is server state (leads, vendors, orders) which React Query handles. Local UI state can use React useState/useContext. | React Query + useState |
| GraphQL / Apollo | Adds complexity without benefit at this scale. REST API routes are sufficient. GraphQL makes sense when multiple clients (web + mobile) consume the same API with different field requirements — valid at Phase 2 when mobile apps launch. | REST with Next.js Route Handlers |
| JWT stored in localStorage | XSS vulnerability. Vendor session tokens in localStorage can be stolen. | HTTP-only cookies via Auth.js |
| Mongoose (MongoDB ODM) | Coupled to MongoDB which is wrong DB choice here. | Prisma with PostgreSQL |
| Socket.IO polling-only mode | Falls back to HTTP long-polling on poor networks (common in Indian tier-2 cities). Ensure WebSocket upgrade is configured correctly. | Socket.IO with proper WebSocket configuration + Redis adapter |

---

## Stack Patterns by Variant

**For vendor scoring algorithm (runs on every lead):**
- Compute score in a BullMQ worker (not in the API route)
- Cache per-vendor base scores in Redis (update on subscription change, rating update, response rate update)
- Recompute fairness rotation weight daily via cron
- Store final score in PostgreSQL on lead assignment record
- Do NOT compute score synchronously in the request-response cycle

**For OTP flow (phone-first India):**
- POST /api/auth/send-otp → generate 6-digit OTP → store SHA256(OTP) in Redis with 10-min TTL → send via MSG91
- POST /api/auth/verify-otp → retrieve from Redis → compare hash → create Auth.js session → delete Redis key
- Rate limit: 3 OTP requests per phone per 10 minutes (use Redis counter with TTL)

**For lead routing (Mode B — Top 3 Vendors):**
- Customer submits lead form → API creates lead record (status: pending) → enqueues BullMQ job
- BullMQ worker: query PostgreSQL for vendor scores in city+category → apply fairness rotation → assign top 3 → send push notifications via Firebase Admin SDK → update lead status to assigned
- Vendors see new lead via Socket.IO push (real-time) AND Firebase FCM (if tab not open)

**For subscription billing:**
- Razorpay Subscriptions for recurring billing
- Webhook endpoint /api/webhooks/razorpay → validate signature → update subscription status in PostgreSQL
- Webhook events to handle: subscription.activated, subscription.charged, subscription.halted, subscription.cancelled

**For product marketplace (B2B):**
- Suppliers manage products via vendor dashboard
- Customers browse via Next.js SSR/ISR pages (product catalog)
- Orders flow through Razorpay Orders API
- Commission split calculated server-side, not client-side

**At 500 vendors (Phase 1):**
- Single Next.js instance on Vercel
- BullMQ workers on Railway (1 instance)
- Socket.IO server on Railway (same instance as workers)
- Neon Postgres (free tier → starter plan)
- Upstash Redis

**At 5,000 vendors (Phase 2):**
- Vercel Pro with ISR for listing pages
- Multiple BullMQ worker instances on Railway
- Socket.IO with Redis adapter (horizontal scaling)
- Neon Pro or migrate to self-hosted Postgres on Railway
- Upstash Redis Pro

**At 30,000 vendors (Phase 3):**
- Re-evaluate to self-hosted: AWS/GCP + Kubernetes
- Postgres read replicas for vendor listing queries
- Redis Cluster
- Separate CDN for media (CloudFront + S3)
- Consider splitting frontend and API into separate deployments

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15 | React 19 | Next.js 15 ships with React 19 support. Do not use React 18 with Next.js 15 — some Server Component APIs differ. |
| Auth.js v5 | Next.js 14+ | Auth.js v5 is built for App Router. Do not use NextAuth v4 with App Router — it has known session issues with RSC. |
| Prisma 5.x | PostgreSQL 15/16 | Prisma 5 supports PostgreSQL 15 and 16. Verify Neon/Supabase PostgreSQL version at sign-up. |
| BullMQ 5.x | Redis 7.x | BullMQ 5 requires Redis 7+. Upstash Redis supports Redis 7 protocol. Verify at Upstash dashboard. |
| Socket.IO 4.x | Node.js 18+ | Socket.IO 4 requires Node.js 18 LTS minimum. Node 22 LTS is recommended. |
| TanStack Query 5 | React 18+ | TanStack Query v5 dropped React 16/17 support. Works with React 19. |
| Tailwind CSS 4.x | PostCSS 8 | Tailwind v4 uses a new Vite/PostCSS pipeline. Verify Next.js Tailwind integration guide for v4 — may require updated postcss.config. |
| shadcn/ui | Tailwind + Radix UI | shadcn/ui components work with both Tailwind v3 and v4 but may need component-level updates for v4. Check shadcn changelog. |

---

## Sources

- Training knowledge (cutoff August 2025) — Next.js, React, TypeScript, PostgreSQL, Redis, Prisma, BullMQ, Auth.js patterns — MEDIUM confidence (established patterns, but verify versions)
- Razorpay official docs pattern knowledge — subscription, orders, webhooks — MEDIUM confidence (verify RazorpayX Payouts eligibility)
- MSG91 DLT compliance pattern for Indian market — LOW confidence (verify current DLT onboarding requirements at trai.gov.in and MSG91 docs)
- Firebase Admin SDK FCM integration pattern — MEDIUM confidence (FCM v1 API replaced legacy API in 2024, verify SDK version supports FCM v1)
- BullMQ + Redis architecture pattern for marketplace lead queuing — HIGH confidence (well-documented pattern)
- Socket.IO + Redis adapter horizontal scaling pattern — MEDIUM confidence
- Upstash + Vercel + Next.js serverless pattern — MEDIUM confidence

**Version verification checklist (do before starting):**
- [ ] Next.js current stable: https://github.com/vercel/next.js/releases
- [ ] Auth.js v5 stable status: https://authjs.dev/getting-started
- [ ] Prisma current: https://www.prisma.io/docs/getting-started
- [ ] BullMQ current: https://docs.bullmq.io/
- [ ] Razorpay Node SDK: https://razorpay.com/docs/api/
- [ ] MSG91 DLT requirements: https://msg91.com/help/DLT
- [ ] Firebase Admin FCM v1 migration: https://firebase.google.com/docs/cloud-messaging/migrate-v1
- [ ] Tailwind v4 stability + Next.js integration: https://tailwindcss.com/docs/installation/framework-guides
- [ ] Upstash Redis + BullMQ compatibility: https://upstash.com/docs/redis/integrations/bullmq

---

*Stack research for: Zevento Pro — multi-sided event marketplace (India)*
*Researched: 2026-03-04*
*Note: Context7 and WebFetch unavailable during this session. All version numbers require verification before use.*
