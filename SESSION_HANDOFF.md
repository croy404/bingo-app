# SESSION HANDOFF — BINGO App
**Last updated:** 2026-06-01 (end of session 4). App is deployed and healthy.
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
- Alert monitor reads Redis price cache first, getLtp(force:true) fallback ✅ (commit 95a1a9e)
- Watchlist GET enriched with Redis-cached ltp/changePercent/change/prevClose ✅
- Alerts GET maps to snake_case (fixed is_active/triggered_count bug) + Redis LTP ✅
- Intraday summary route created (FIFO P&L, win rate, per-symbol) ✅
- Symbols tab search fixed (input+button → populates results table) ✅
- Watchlist auto-refresh 30s polling added ✅
- Alerts table shows LTP + distance% columns, highlights crossed alerts ✅
- NSE-blocked routes fixed: shared `getNifty50Data()` in `lib/market-data.ts` tries NSE first, Yahoo batch fallback, Redis-cached 5 min ✅ (commit 63cfb8b)
- Affected: `/market/nifty50`, `/market/breadth`, `/market/screener`, `/market/52week`, `/market/sector-rotation` ✅

---

## 3. Outstanding issues (things to fix next)

### HIGH PRIORITY (functional bugs)
1. **Fyers login still needs user portal action** — user must go to myapi.fyers.in, set redirect URI
   to `https://maxcap.co.in/api/broker/fyers/callback`, Save, then try login from the app.

2. **ICICI streaming only verifiable during market hours** (08:55–15:45 IST) — needs symbols in
   watchlist + portfolio for the worker to subscribe to. Token lookup uses Shoonya NSE master.

3. **NSE-direct routes blocked from datacenter** — `/market/nifty50`, `/market/breadth`,
   `/market/screener`, `/options` get HTML block page from NSE. These work when a broker is connected.

### MEDIUM PRIORITY
4. **Export CSV format** — user wants CSV to match old Replit app format exactly. Need to check
   the old app's export fields and match them in `/api/export/route.ts`.

5. **ICICI Security Master** — `resolveSymbol()` in `broker-icici.ts` checks `symbols` table with
   `exchange=ICICI`. This table is likely empty (Security Master never downloaded). The static
   `SYMBOL_OVERRIDES` map covers Nifty50 stocks. For other stocks, fallback is the raw symbol
   which may not match ICICI's stock code.

### LOW PRIORITY
6. **GitHub webhook auto-deploy** — still broken (secret mismatch). Low priority since Coolify
   API deploy works fine.

7. **Mobile layout** — sidebar hidden on mobile but no hamburger menu / bottom nav for mobile users.

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

## 6. Next tasks (in priority order)
1. **Fyers login** — user registers redirect URI at myapi.fyers.in, then tests OAuth flow.
2. **Export CSV format** — compare with old Replit app fields and match exactly (`/api/export/route.ts`).
3. **Mobile layout** — add hamburger toggle for sidebar on mobile (sidebar hidden, no way to navigate on phones).
4. **ICICI Security Master** — optional; static SYMBOL_OVERRIDES covers Nifty50.

---

## 7. Context window strategy (READ THIS)
Sessions get heavy fast. Use this workflow:
- **Fresh session**: paste RESUME_PROMPT.md → Claude reads 3 files → 5-line summary → work.
- **Each task**: one focused task per message. Don't combine many changes.
- **After each task**: ask Claude to update SESSION_HANDOFF.md and CURRENT_TASK.md.
- **Context too big**: start a new chat, paste RESUME_PROMPT.md content. Sonnet is fine for
  most tasks. Use Opus only for architecture decisions.
- The 3 docs (CLAUDE.md, SESSION_HANDOFF.md, RESUME_PROMPT.md) ARE the memory. Keep them tight.
