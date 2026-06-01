# CURRENT_TASK.md — paste this into a new session to pick up mid-task

## Project
BINGO Indian market dashboard. Stack: Next.js 16 + Postgres + Redis + Docker → Coolify → EC2.
Live at https://maxcap.co.in. Repo: croy404/bingo-app. Local: C:\Users\cweb4\Downloads\bingo-next

## What was just deployed (commit 2c1ed5a, 2026-06-01)
- Fyers callback: reads `auth_code` param (was reading `code=200`)
- ICICI Breeze WS: uses `sessionToken` not `apiSessionToken` in Socket.IO auth
- Symbol search: name search, strips -EQ suffix, returns baseSymbol
- Full sidebar UI matching old Replit Bingo V3.2
- Groq + Cerebras + OpenRouter API keys set in Coolify

## Current task to work on
**Fix alert LTP + watchlist LTP enrichment** (top two items in SESSION_HANDOFF.md next-10 list)

### Task 1: Alert LTP (worker/index.ts)
The alert monitor calls `getLtp(alert.symbol, alert.exchange)` without `force:true`.
`getLtp` returns stale cache outside 08:55–15:45 IST window (`isAppActive() = false`).
Fix: pass `{ force: true }` so it always tries live sources.
BUT: better fix is read from Redis price cache first (set by WS stream or poll),
only fall back to REST if cache is cold (>5 min old).

Pattern to implement:
```typescript
// In checkAlerts(), instead of getLtp:
const cached = await cacheGet<{ltp:number}>(`price:${alert.exchange}:${alert.symbol}`);
const ltp = cached?.ltp ?? (await getLtp(alert.symbol, alert.exchange, {force:true})).ltp;
```

### Task 2: Watchlist LTP enrichment (app/api/watchlist/route.ts)
GET /api/watchlist currently returns only { id, symbol, exchange } from DB.
UI expects ltp + changePercent fields.
Fix: for each watchlist item, do `cacheGet(`price:${ex}:${sym}`)` and merge into response.

## Before committing
Run: `npm test && DATABASE_URL="postgres://u:p@localhost:5432/db" npm run build`
Deploy: push to main + Coolify API (token in auto-memory bingo-deployment.md)

## Files to edit
- `worker/index.ts` — alert monitor getLtp call
- `app/api/watchlist/route.ts` — enrich with Redis cache
