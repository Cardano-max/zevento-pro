---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client-test-portal.html
autonomous: true

must_haves:
  truths:
    - "Client can open the HTML file locally with no server and see a branded Zevento Pro landing page"
    - "Dark/light mode toggles on click and the choice persists across page reloads via localStorage"
    - "All four user journeys (Customer, Vendor, Supplier, Admin) are visible with their API endpoints listed"
    - "Clicking any endpoint card opens the Swagger UI at localhost:3001/api-docs in a new tab"
    - "The page looks polished and professional — glassmorphism cards, gradient hero, smooth hover micro-animations, Inter font"
  artifacts:
    - path: "client-test-portal.html"
      provides: "Single-file client testing portal, no build tools required"
      min_lines: 400
  key_links:
    - from: "endpoint cards"
      to: "http://localhost:3001/api-docs"
      via: "anchor href target=_blank"
      pattern: "localhost:3001/api-docs"
    - from: "theme toggle button"
      to: "localStorage"
      via: "JS event listener storing 'theme' key"
      pattern: "localStorage.setItem.*theme"
---

<objective>
Build a single standalone HTML file that serves as a polished client-facing API testing portal for Zevento Pro.

Purpose: Give the client a beautiful branded entry point to explore and test all 93 API endpoints organized by user journey — professional enough to send externally without setup instructions.
Output: /Users/mac/Desktop/zavento/client-test-portal.html — open in any browser, no server, no npm.
</objective>

<execution_context>
@/Users/mac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build the Zevento Pro client testing portal HTML file</name>
  <files>/Users/mac/Desktop/zavento/client-test-portal.html</files>
  <action>
Create a single self-contained HTML file at the project root. No build tools, no npm, no server required — the client double-clicks to open.

**Visual design — 2026 aesthetic:**
- Font: Inter from Google Fonts CDN (weights 300, 400, 500, 600, 700)
- Icons: Lucide Icons CDN (https://unpkg.com/lucide@latest/dist/umd/lucide.min.js)
- Color system: two CSS custom-property palettes, one for light mode, one for dark mode, swapped on `data-theme="dark"` on `<html>`:
  - Light: `--bg` #f8f7ff, `--surface` #ffffff, `--surface-2` #f1f0ff, `--border` #e2e0f0, `--text` #1a1825, `--text-muted` #6b6880, `--accent` #6c47ff, `--accent-light` #ede9ff
  - Dark: `--bg` #0f0e17, `--surface` #1a1826, `--surface-2` #221f32, `--border` #2e2b42, `--text` #f0eeff, `--text-muted` #9590b0, `--accent` #8b6fff, `--accent-light` #2a2244
- Hero section: full-width gradient banner using `background: linear-gradient(135deg, #6c47ff 0%, #a855f7 50%, #ec4899 100%)` with subtle animated noise texture overlay (CSS background-image with an SVG turbulence filter, 3% opacity) — keep animation subtle, `animation: drift 20s ease infinite alternate`
- Glassmorphism journey cards: `backdrop-filter: blur(12px)`, `background: rgba(var(--surface-rgb), 0.7)`, 1px border with 20% opacity accent color, `border-radius: 20px`, `box-shadow: 0 8px 32px rgba(0,0,0,0.08)`
- Endpoint pill cards: `border-radius: 10px`, subtle `border-left: 3px solid` colored by HTTP method (POST=#6c47ff, GET=#10b981, PATCH=#f59e0b, DELETE=#ef4444), hover lifts with `transform: translateY(-2px)`, `transition: all 0.2s ease`
- Theme toggle: circular button top-right of nav, sun/moon icon from Lucide, `transition: transform 0.3s ease` rotates on toggle

**HTML structure:**
```
<html data-theme="light">
<head>
  <!-- Google Fonts: Inter -->
  <!-- Lucide Icons CDN -->
  <style>/* all CSS inline */</style>
</head>
<body>
  <nav> <!-- logo left, theme toggle right --> </nav>
  <section class="hero"> <!-- gradient hero with headline + subline + Swagger CTA button --> </section>
  <main class="journeys"> <!-- 4 journey sections --> </main>
  <footer> <!-- simple: "Zevento Pro API — Built with NestJS — localhost:3001" --> </footer>
  <script>/* theme toggle + lucide.createIcons() */</script>
</body>
```

**Hero content:**
- Logo: "Z" monogram in a gradient circle + "Zevento Pro" wordmark
- Headline: "API Testing Portal" (large, white, bold)
- Subline: "Zevento Pro — India's Multi-Sided Event Marketplace. Explore all 93 endpoints organized by user journey."
- CTA button: "Open Swagger UI →" — links to http://localhost:3001/api-docs (target="_blank"), styled as white pill button with accent hover

**Four journey sections** — each section has:
- A colored top-accent heading strip (gradient pill badge with role label)
- A glassmorphism card wrapping a grid of endpoint pills
- Each endpoint pill shows: HTTP method badge (POST/GET/PATCH/DELETE), the path, and a short description
- Clicking the card/pill opens http://localhost:3001/api-docs in a new tab (one simple href on the anchor, NOT deep-linking into swagger — just opening the docs root is correct)

CUSTOMER JOURNEY (accent: purple #6c47ff):
1. POST /auth/otp/send — Send OTP to phone
2. POST /auth/otp/verify — Verify OTP and get session
3. GET /customer/categories — Browse event categories
4. GET /customer/vendors — Search and filter vendors
5. POST /leads/inquiries — Submit event inquiry (with consent)
6. GET /leads/:leadId/quotes — View vendor quotes
7. POST /quotes/:id/accept — Accept best quote
8. POST /payments/orders — Create payment order
9. POST /payments/verify — Verify payment signature
10. POST /bookings/:id/review — Leave verified review

VENDOR JOURNEY (accent: violet #7c3aed):
1. POST /vendor/profile — Create vendor profile
2. PATCH /vendor/profile/business — Update business details
3. POST /vendor/profile/kyc/submit — Submit KYC documents
4. GET /subscriptions/plans — Browse subscription tiers
5. POST /subscriptions/checkout — Start subscription billing
6. GET /inbox — View lead inbox (real-time)
7. PATCH /inbox/assignments/:id/accept — Accept an incoming lead
8. POST /leads/:leadId/quotes — Create a quote
9. PATCH /quotes/:id/submit — Submit quote to customer
10. PATCH /bookings/:id/status — Update booking status

SUPPLIER JOURNEY (accent: emerald #10b981):
1. POST /products — List a new product
2. POST /products/:id/images — Upload product images
3. GET /catalog/products — Browse product catalog
4. POST /orders — Place a B2B order
5. PATCH /orders/:id/status — Update fulfillment status

ADMIN JOURNEY (accent: amber #f59e0b):
1. GET /admin/vendors/kyc-queue — View pending KYC queue
2. POST /admin/vendors/:id/kyc-review — Approve or reject vendor
3. GET /admin/analytics/dashboard — Platform analytics dashboard
4. GET /admin/leads/:id/routing-trace — Inspect lead routing log
5. PATCH /admin/leads/:id/routing-override — Override vendor assignment
6. GET /admin/markets — List all markets
7. PATCH /admin/markets/:id/status — Enable or disable a market

**Dark/light mode JS (in `<script>` at bottom):**
```js
// Init theme from localStorage or system preference
const saved = localStorage.getItem('zevento-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initial = saved || (prefersDark ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', initial);

// Toggle on button click
document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('zevento-theme', next);
  updateToggleIcon(next);
});

function updateToggleIcon(theme) {
  // swap between lucide sun and moon icons
}

// After DOM ready, init lucide icons
lucide.createIcons();
updateToggleIcon(initial);
```

**Quality bar:** The page must look good enough that a non-technical client would be impressed. No lorem ipsum, no "coming soon" placeholders. All content is real Zevento Pro data. Typography must be crisp with proper line-height (1.6 for body, 1.1 for headings). Spacing uses an 8px grid. Mobile-responsive: stacks to 1 column on screens under 768px.

Do NOT use Tailwind CDN — write all CSS as a `<style>` block in the `<head>`. This avoids CDN latency and the utility-class verbosity in HTML makes the source harder to read. Pure CSS gives full control over the glassmorphism and animation effects.
  </action>
  <verify>
    1. Open /Users/mac/Desktop/zavento/client-test-portal.html in a browser (file:// protocol)
    2. Confirm the page renders without any console errors
    3. Click the theme toggle — page switches between dark and light mode
    4. Reload the page — theme persists (localStorage working)
    5. Click "Open Swagger UI →" — http://localhost:3001/api-docs opens in new tab (requires API running)
    6. Confirm all 4 journey sections are visible with their endpoint lists
    7. Hover over an endpoint pill — confirm lift animation
    8. Resize browser to mobile width — layout stacks cleanly
  </verify>
  <done>
    Single HTML file exists at /Users/mac/Desktop/zavento/client-test-portal.html. Opens locally in any browser. Shows Zevento Pro branding, all 4 user journeys with 32 listed endpoints, working dark/light toggle with localStorage persistence, and a Swagger UI link. Looks polished and professional.
  </done>
</task>

</tasks>

<verification>
- [ ] File exists: /Users/mac/Desktop/zavento/client-test-portal.html
- [ ] File size > 400 lines (meaningful implementation, not a stub)
- [ ] `localStorage.setItem.*theme` pattern present in the JS
- [ ] `localhost:3001/api-docs` appears as a link target
- [ ] All 4 journey names appear: Customer, Vendor, Supplier, Admin
- [ ] `data-theme` attribute switching logic present
- [ ] No `npm`, no `node_modules`, no build references
</verification>

<success_criteria>
A non-technical client can receive this file, double-click it, and immediately understand what Zevento Pro does and how to test its API. The page is visually polished with 2026 design trends (glassmorphism, gradient hero, micro-animations), functions in both dark and light mode with persistence, and serves as a professional handoff artifact.
</success_criteria>

<output>
After completion, create `.planning/quick/001-full-beautiful-interactive-client-testin/001-SUMMARY.md` with what was built, file path, and any notes.
</output>
