# SESSION HANDOFF — BINGO App
**Last updated:** 2026-06-01 (end of session 2). App is deployed and healthy.
Read `CLAUDE.md` first for quick guide. Secrets in local auto-memory `bingo-deployment.md`.

---

## 1. Stack (do not change)
- GitHub (`croy404/bingo-app`, branch `main`) → Coolify → AWS EC2 t3.medium ap-south-1
- **App** `/Dockerfile` Next.js 16 standalone, port 3000, `https://maxcap.co.in` — UUID `ggkyez6sftnzxqhq1jku14f2`
- **Worker** `/Dockerfile.worker` tsx, no port — UUID `jqmmwoqn4qcemc9nawzadd1r`
- Postgres 16 + Redis 7 as Coolify resources on same box
- Deploy: `git push` then POST to Coolify API (token in auto-memory). **Never wait on GitHub webhook.**

---

## 2. What IS working (verified 2026-06-01)
- `/api/health` → postgres + redis connected ✅
- `/api/ai/status` → Groq ✅ Cerebras ✅ OpenRouter ✅ (Anthropic not set — not needed)
- UI: full sidebar layout matching Replit Bingo V3.2 ✅
- SymbolCombobox autocomplete wired everywhere ✅
- Fyers OAuth redirect: `auth_code` param fix ✅, `APP_URL` env pinned ✅
- ICICI Breeze WS: correct `sessionToken` in Socket.IO auth ✅
- Symbol search: name/contains OR, `baseSymbol` strips `-EQ` ✅
- All AI routes exist and API keys set in Coolify ✅
- Morning brief, EOD P&L, filings monitor in worker ✅
- `/api/broker/stream-status` endpoint ✅

---

## 3. Outstanding issues (things to fix next)

### HIGH PRIORITY (functional bugs)
1. **LTP fetch on Alerts tab is broken** — alert monitor calls `getLtp()` but ICICI `breezeLtp` uses
   `resolveSymbol()` which looks up ICICI Security Master (exchange=`ICICI` in symbols table) — that
   table is likely empty (Security Master never downloaded). Fallback chain: ICICI → Fyers → Yahoo.
   Yahoo fallback should work but needs `isAppActive()` to return true (market hours only).
   **Fix:** Make alert LTP check use Yahoo as guaranteed fallback outside market hours too,
   OR allow `force:true` in alert monitor getLtp calls. File: `worker/index.ts` line ~65 (`getLtp`
   call) and `lib/ltp.ts`.

2. **Fyers login still needs user portal action** — user must go to myapi.fyers.in, set redirect URI
   to `https://maxcap.co.in/api/broker/fyers/callback`, Save, then try login from the app.

3. **ICICI streaming only verifiable during market hours** (08:55–15:45 IST) — needs symbols in
   watchlist + portfolio for the worker to subscribe to. Token lookup uses Shoonya NSE master.

4. **NSE-direct routes blocked from datacenter** — `/market/nifty50`, `/market/breadth`,
   `/market/screener`, `/options` get HTML block page from NSE. These work when a broker is connected.

### MEDIUM PRIORITY
5. **Alert LTP uses REST not Redis** — worker alert check calls `getLtp()` which hits ICICI/Yahoo REST
   every 30s per symbol. Once WS streaming works, alert monitor should read from Redis
   (`price:EXCHANGE:SYMBOL`) directly instead of making REST calls. Much faster + no rate limits.

6. **Watchlist tab doesn't show live LTP** — `/api/watchlist` route returns DB rows only (symbol,
   exchange). It doesn't join with Redis price cache. Need to enrich with cached prices.
   File: `app/api/watchlist/route.ts`

7. **Symbol search in Symbols tab doesn't update `symResults`** — the `SymbolCombobox` in Symbols
   page calls `onSelect` but the `symResults` state is only set by the old manual search. The
   `SymbolCombobox` itself shows its own internal dropdown; the table below it never updates.
   Fix: Wire the `/api/symbols/search` results to the `symResults` state in the Symbols tab.

8. **Intraday summary API** — route `/api/intraday/summary` may not exist. Check:
   `find app/api/intraday -type f`. If missing, add it.

9. **Export CSV format** — user wants CSV to match old Replit app format exactly. Need to check
   the old app's export fields and match them in `/api/export/route.ts`.

### LOW PRIORITY
10. **ICICI Security Master** — `resolveSymbol()` in `broker-icici.ts` checks `symbols` table with
    `exchange=ICICI`. This table is likely empty (Security Master never downloaded). The static
    `SYMBOL_OVERRIDES` map covers Nifty50 stocks. For other stocks, fallback is the raw symbol
    which may not match ICICI's stock code. Add a Security Master download route or use Shoonya
    tokens directly (already done for WS streaming).

11. **GitHub webhook auto-deploy** — still broken (secret mismatch). Low priority since Coolify
    API deploy works fine.

---

## 4. Files map (key files to know)
```
app/page.tsx              — entire single-page UI (sidebar layout, all tabs)
app/api/broker/
  fyers/callback/route.ts — reads auth_code (not code) from Fyers redirect
  fyers/prepare/route.ts  — builds OAuth URL using APP_URL env
  icici/oauth-callback/   — ICICI OAuth callback
  stream-status/route.ts  — returns WS tick freshness from Redis
app/api/alerts/route.ts   — CRUD + toggle
app/api/watchlist/route.ts — NEEDS enrichment with Redis LTP
app/api/export/route.ts   — CSV export (check format matches old app)
app/api/intraday/         — check if /summary subpath exists
lib/ltp.ts                — unified LTP: ICICI→Fyers→Yahoo. Outside active window returns cached.
lib/broker-icici.ts       — breezeLtp, resolveSymbol, SYMBOL_OVERRIDES
lib/breeze-ws.ts          — Socket.IO WS to livestream.icicidirect.com (sessionToken fixed)
lib/fyers-ws.ts           — WebSocket to socket.fyers.in
lib/symbols.ts            — searchSymbols (name/contains OR, returns baseSymbol)
worker/index.ts           — alert monitor (reads getLtp), streamPrices, schedulers
```

---

## 5. Env vars in Coolify (both app + worker)
`DATABASE_URL`, `REDIS_URL`, `CRON_SECRET=bingo_cron_secret_2026`, `NODE_ENV=production`,
`APP_URL=https://maxcap.co.in`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`

---

## 6. Next 10 tasks (in priority order)
1. **Fix alert LTP** — pass `force:true` to `getLtp` in `worker/index.ts` alert monitor so it
   doesn't return stale cache outside active window. Also add Redis read shortcut.
2. **Enrich watchlist route** — join Redis price cache into `/api/watchlist` GET response.
3. **Fix Symbols tab search** — wire `SymbolCombobox` results to the results table below it.
4. **Verify/add intraday summary route** — check `app/api/intraday/[date]/route.ts` exists.
5. **Fyers login verification** — user must register redirect URI at myapi.fyers.in first.
6. **Alert monitor → Redis-first LTP** — read `price:EXCHANGE:SYMBOL` from Redis in worker,
   fall back to REST only if missing. Eliminates ICICI/Yahoo REST calls every 30s.
7. **NSE-blocked routes** — add broker data fallback for nifty50/breadth/screener when NSE is blocked.
8. **Export CSV format** — compare with old Replit app fields and match exactly.
9. **Mobile layout pass** — sidebar needs mobile hamburger menu.
10. **ICICI Security Master download** — optional; static SYMBOL_OVERRIDES covers Nifty50.

---

## 7. Context window strategy (READ THIS)
Sessions get heavy fast. Use this workflow:
- **Fresh session**: paste RESUME_PROMPT.md → Claude reads 3 files → 5-line summary → work.
- **Each task**: one focused task per message. Don't combine many changes.
- **After each task**: ask Claude to update SESSION_HANDOFF.md and CURRENT_TASK.md.
- **Context too big**: start a new chat, paste RESUME_PROMPT.md content. Sonnet is fine for
  most tasks. Use Opus only for architecture decisions.
- The 3 docs (CLAUDE.md, SESSION_HANDOFF.md, RESUME_PROMPT.md) ARE the memory. Keep them tight.
