# Zevento Production Deployments

Last deployed: 2026-03-15

## Services

| App | URL | Platform | Status |
|-----|-----|----------|--------|
| API (NestJS) | https://zevento-api.onrender.com | Render (auto-deploy from GitHub master) | Live |
| Customer Web | https://web-xi-flax-21.vercel.app | Vercel | Live |
| Vendor Dashboard | https://vendor-sooty.vercel.app | Vercel | Live |
| Admin Dashboard | https://admin-roan-one-51.vercel.app | Vercel | Live |

## Vercel Deployment Details

### Customer Web App (`apps/web`)
- Project: `ateebs-projects-0a03cec8/web`
- Production URL: https://web-xi-flax-21.vercel.app
- Deployment: https://web-egdhixjb7-ateebs-projects-0a03cec8.vercel.app
- Pages: Home, Feed, Vendors, Vendor Detail, Dashboard, Favorites, Inbox, Login, Plan

### Vendor Dashboard (`apps/vendor`)
- Project: `ateebs-projects-0a03cec8/vendor`
- Production URL: https://vendor-sooty.vercel.app
- Deployment: https://vendor-84x8pkwfp-ateebs-projects-0a03cec8.vercel.app
- Pages: Dashboard, Inbox, Bookings, Calendar, Reviews, Subscription, Profile, Products, Login

### Admin Dashboard (`apps/admin`)
- Project: `ateebs-projects-0a03cec8/admin`
- Production URL: https://admin-roan-one-51.vercel.app
- Deployment: https://admin-hbovql9uv-ateebs-projects-0a03cec8.vercel.app
- Pages: Dashboard, Vendors, Leads, Bookings, Payments, Commission Rates, Markets, Feed, Reports, Users, Login

## API (Render)

- Service: `zevento-api`
- URL: https://zevento-api.onrender.com
- Deploy: GitHub push to `master` triggers auto-deploy
- Repo: https://github.com/Cardano-max/zevento-pro

## Architecture Notes

- All frontend apps proxy API calls via `/api/proxy/[...path]` to avoid CORS issues
- CORS configured on API to allow `*.vercel.app` domains
- Each frontend is a separate Vercel project with independent deploy settings
- API uses Render's free/starter tier with auto-sleep (cold start ~30s on first request)
