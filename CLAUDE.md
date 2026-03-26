# Hireabble - Claude Development Notes

## Project Overview
- **Frontend**: React (CRA) at `frontend/`
- **Backend**: Node/Express at `backend/`
- **PWA**: Service worker at `frontend/public/service-worker.js`

## Fix Log

Track of significant fixes. If something regresses, check here for the working approach and revert commit.

### Impersonation (Admin Testing → Impersonate User)

**Problem**: Switching between impersonated users shows the wrong user (User A data appears when impersonating User B).

This has been fixed MULTIPLE times. The root causes are always cache-related.

| Date | Commit | What Broke | Fix | Key Files |
|------|--------|-----------|-----|-----------|
| 2026-03-10 | `af821f7` | SW static cache (`hireabble-v4`) cached `/api/auth/me` responses; only `hireabble-api-v7` was being cleared | 1. SW: skip `/api/` URLs in static catch-all handler 2. Clear ALL caches everywhere (not just `hireabble-api-v7`) 3. Removed `logout()` from Impersonate.jsx | `service-worker.js`, `AuthContext.js`, `Impersonate.jsx`, `ImpersonationBanner.jsx`, `AdminTesting.jsx` |
| 2026-03-10 | `5f787c8` | `Impersonate.jsx` called `logout()` before `loginWithToken()` causing race condition (`useEffect([token])` in AuthContext competed with loginWithToken) | Removed `logout()` call — `loginWithToken()` handles all cleanup internally | `Impersonate.jsx`, `AuthContext.js` |
| 2026-03-10 | `3b8ab6c` | SW API cache held stale `/auth/me` response keyed by URL only (ignores Auth header) | Clear `hireabble-api-v7` cache before impersonation | `AdminTesting.jsx` |
| 2026-03-10 | `d877500` | Same SW cache issue | Clear SW cache on impersonate | `AdminTesting.jsx` |
| 2026-03-10 | `cb46e6e` | Same SW cache issue, first occurrence | Clear SW cache on impersonate | Multiple files |

**Golden rules for impersonation:**
1. **NEVER** call `logout()` before `loginWithToken()` — it causes a race condition
2. `loginWithToken()` must handle ALL cleanup: abort auth init, clear localStorage, purge ALL caches, then set new token
3. Service worker must NEVER cache `/api/` URLs in the static asset handler
4. Always clear ALL caches (`caches.keys()` then delete each), not just a specific named cache
5. `skipNextAuthInit` ref in AuthContext prevents `useEffect([token])` from competing with `loginWithToken`

### Service Worker Caching

**Problem**: Stale data appearing after user actions (stats showing old counts, dashboard flickering).

| Date | Commit | What Broke | Fix | Key Files |
|------|--------|-----------|-----|-----------|
| 2026-03-10 | `af821f7` | Static asset catch-all (`hireabble-v4`) cached API responses | Added `/api/` URL check to skip catch-all handler | `service-worker.js` |
| 2026-03-10 | `960c9a8` | Per-user API endpoints cached by SW (stats, dashboard, notifications) | Restricted `isCacheableApi()` to only `/api/oauth/config` | `service-worker.js` |

**Golden rules for SW caching:**
1. Only cache truly static, non-user-specific GET responses (currently only `/api/oauth/config`)
2. The catch-all static handler must exclude `/api/` URLs
3. When clearing caches, use `caches.keys()` + delete all — don't hardcode cache names

### Stats / Dashboard Data

**Problem**: Stats showing wrong numbers (e.g., "14 Applied but only 7 applications").

| Date | Commit | What Broke | Fix | Key Files |
|------|--------|-----------|-----|-----------|
| 2026-03-10 | `5f787c8` | `mergeStatsWithCache` used `Math.max(server, local)` which inflated counts | Replaced with "pending increment" pattern; added duplicate match guards | `SeekerDashboard.jsx`, `RecruiterSwipe.jsx` |
| 2026-03-10 | `eeea488` | Stats regressed when navigating back to swipe page | Fix stats calculation on navigation | `RecruiterSwipe.jsx` |

### Match Modal

**Problem**: Match modal not appearing after a mutual swipe.

| Date | Commit | Fix |
|------|--------|-----|
| 2026-03-10 | `5f787c8` | Made match detection inline (synchronous) instead of background task, so API response includes match data and modal triggers immediately |

### Null Subscription Crashes

**Problem**: App crashes when `user.subscription` is null/undefined.

| Date | Commit | Fix |
|------|--------|-----|
| 2026-03-10 | `ec9ff31` | Added null checks for subscription in dashboard and undo endpoints |

## Architecture Notes

### Auth Flow
- `AuthContext.js` manages auth state with `useEffect([token])` that calls `/api/auth/me`
- `loginWithToken()` is used for impersonation — it bypasses the normal useEffect by setting `skipNextAuthInit.current = true`
- `authInitController` (AbortController ref) prevents stale auth requests from overwriting current user

### Service Worker (`frontend/public/service-worker.js`)
- Cache names: `hireabble-v4` (static), `hireabble-api-v7` (API), `hireabble-images-v1` (images)
- Images: cache-first (immutable)
- `/api/oauth/config`: stale-while-revalidate
- `/api/*` (all other): NO caching (pass-through to network)
- Static assets: cache-first with network fallback

### Key Files
- `frontend/src/context/AuthContext.js` — Auth state, login/logout, token management
- `frontend/src/pages/Impersonate.jsx` — Impersonation entry point
- `frontend/src/components/ImpersonationBanner.jsx` — "Back to Admin" banner + cleanup
- `frontend/src/pages/admin/AdminTesting.jsx` — Admin panel test user impersonation
- `frontend/public/service-worker.js` — PWA service worker with caching strategies

## Operations & Backup

### Error Tracking
- **Frontend**: Sentry (`@sentry/react`) — set `REACT_APP_SENTRY_DSN` env var
- **Backend**: Sentry (`sentry-sdk[fastapi]`) — set `SENTRY_DSN` env var
- Both auto-disable if DSN is not set (no-op in dev)

### Uptime Monitoring
- Backend health endpoint: `GET /api/health` (returns `{"status": "healthy"}`)
- Railway health check configured in `railway.toml` (30s timeout)
- **Recommended**: Set up external monitoring (UptimeRobot, Pingdom, or BetterUptime) pointing at `https://your-backend.up.railway.app/api/health`

### MongoDB Backup Strategy
- **Atlas M0 (Free)**: No automated backups. Must use `mongodump` manually or upgrade to M2+.
- **Atlas M2+**: Daily automated snapshots included. PITR (Point-in-Time Recovery) on M10+.
- **Manual backup**: `mongodump --uri="$MONGO_URL" --out=./backup-$(date +%Y%m%d)`
- **Restore**: `mongorestore --uri="$MONGO_URL" --drop ./backup-YYYYMMDD/`
- **Recovery targets**: RPO (Recovery Point Objective) < 24h, RTO (Recovery Time Objective) < 1h
- **Critical collections**: `users`, `jobs`, `applications`, `matches`, `messages`

### Disaster Recovery Checklist
1. MongoDB: Restore from Atlas snapshot or `mongodump` backup
2. File storage: Uploaded files are stored on Railway volume — ensure volume is attached and persistent
3. Backend: Redeploy from git on Railway (`railway up` or push to main)
4. Frontend: Redeploy from git on Vercel (auto-deploys on push)
5. Environment variables: Stored in Railway/Vercel dashboards — keep an encrypted copy offline
