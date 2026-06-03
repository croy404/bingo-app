# SESSION HANDOFF — BINGO App
**Last updated:** 2026-06-01 (end of session 6). Build essentially complete. App healthy.
Read `CLAUDE.md` first for quick guide. Secrets in local auto-memory `bingo-deployment.md`.

---

## 1. Stack (do not change)
- GitHub (`croy404/bingo-app`, branch `main`) → Coolify → AWS EC2 t3.medium ap-south-1
- **App** `/Dockerfile` Next.js 16, port 3000, `https://13-203-185-106.sslip.io` — UUID `ggkyez6sftnzxqhq1jku14f2`
- **Worker** `/Dockerfile.worker` tsx, no port — UUID `jqmmwoqn4qcemc9nawzadd1r`
- Postgres 16 (Prisma, `prisma db push` on boot) + Redis 7 (ioredis)
- Deploy: `git push` → POST to Coolify API (token in auto-memory). Never rely on GitHub webhook.

---

## 2. What IS working — full feature list (as of commit 3097fcc)

### Pages
| Page | Status |
|------|--------|
| Dashboard — indices, breadth, Nifty 50 heatmap, FII/DII bar chart, AI overview, stats ribbon | ✅ |
| Watchlist — SSE live prices every 3s, 30s fallback polling, Redis LTP enriched | ✅ |
| Portfolio — holdings (XIRR), Sectors tab (bar chart), Benchmark tab (Nifty 2Y + alpha) | ✅ |
| SIP Tracker — XIRR per SIP, instalment log | ✅ |
| Intraday — FIFO P&L, per-symbol status, win rate | ✅ |
| Trade Journal — entries, daily notes, AI analysis | ✅ |
| Screener — gainers/losers/52-week/volume surges/sector (Yahoo fallback) + AI Trade Ideas + AI Weekly Plan | ✅ |
| News + NSE/BSE Filings | ✅ |
| Alerts — LTP, distance%, crossed-alert highlight, Telegram notify | ✅ |
| Alert History — Diff% column | ✅ |
| Options — underlying from Yahoo when NSE blocked; broker note for chain | ✅ |
| Correlation Matrix — Pearson 60-day Yahoo, 12-symbol, colour heatmap | ✅ |
| Brokers — ICICI OAuth + Fyers OAuth flow | ✅ |
| Symbols — 148k Shoonya master, search | ✅ |
| Settings — theme, Telegram, AI provider status | ✅ |

### UX Features
| Feature | How |
|---------|-----|
| Theme — dark / light / sepia | Settings → Appearance (CSS vars, localStorage) |
| Mobile nav | Bottom tab bar + More drawer (md:hidden) |
| Risk Calculator | Press **R** anywhere |
| AI Chat Panel | Green ✦ button bottom-right (persistent, history) |
| Quick Notepad | **Ctrl+Shift+N** (draggable, 400ms autosave) |

### Backend
- Alert monitor: Redis-first LTP, `getLtp(force:true)` fallback — no stale prices
- NSE-blocked routes: all use `getNifty50Data()` (NSE→Yahoo batch→Redis 5 min cache)
- SSE stream: `/api/prices/stream` polls Redis every 3s for requested symbols
- Portfolio categories (equity/mf/etf/sgb/fd/other) + account_tag column in DB
- Prisma schema: 14 models — `category` + `account_tag` added to Portfolio ✅
- Export CSV: includes category, account_tag
- Worker: morning brief 08:30 IST, EOD P&L 15:35 IST, filings monitor 15 min, alert monitor 30s

---

## 3. Outstanding items (minor — core is complete)

1. **User action required** — Fyers redirect URI must be registered at myapi.fyers.in:
   `https://13-203-185-106.sslip.io/api/broker/fyers/callback`
   Until done, Fyers OAuth will fail. ICICI works.

2. **ICICI Security Master** — `resolveSymbol()` uses static `SYMBOL_OVERRIDES` (covers Nifty 50).
   Non-Nifty stocks may use wrong ICICI stock code for WebSocket streaming.

3. **GitHub webhook** — auto-deploy broken (secret mismatch). Use Coolify API deploy. Low priority.

4. **Correlation** — limited to Nifty 50 + BSE symbols Yahoo knows. F&O/index symbols may fail.

---

## 4. Key files map
```
app/page.tsx              — entire single-page React UI (~1900 lines)
lib/market-data.ts        — getNifty50Data() NSE→Yahoo fallback + NiftyStock type
lib/ltp.ts                — unified LTP waterfall (ICICI→Fyers→Yahoo)
lib/redis.ts              — cacheGet/cacheSet helpers
worker/index.ts           — alert monitor, price streaming, schedulers
prisma/schema.prisma      — 14 models including Portfolio with category/account_tag
app/api/market/           — status, indices, nifty50, breadth, screener, fii-dii, 52week, sector-rotation, correlation
app/api/alerts/route.ts   — GET enriches with Redis LTP (snake_case mapping fixed)
app/api/watchlist/route.ts — GET enriches with Redis LTP
app/api/prices/stream/    — SSE endpoint polling Redis every 3s
app/api/portfolio/        — CRUD, pnl, benchmark, snapshots
app/api/screener/volume-surges/ — NSE 500 → Nifty 50 Yahoo fallback
app/api/options/route.ts  — NSE chain → Yahoo underlying fallback
app/globals.css           — CSS variable themes (dark/light/sepia)
```

---

## 5. Env vars (set in Coolify on BOTH app + worker)
```
DATABASE_URL  REDIS_URL  CRON_SECRET=bingo_cron_secret_2026
NODE_ENV=production  APP_URL=https://13-203-185-106.sslip.io   ← sslip.io (no custom domain)
GROQ_API_KEY  CEREBRAS_API_KEY  OPENROUTER_API_KEY
```

---

## 6. Deploy workflow
```bash
git push origin main
curl -X POST "http://13.203.185.106:8000/api/v1/deploy?uuid=ggkyez6sftnzxqhq1jku14f2&force=true" \
  -H "Authorization: Bearer <TOKEN>"
curl -X POST "http://13.203.185.106:8000/api/v1/deploy?uuid=jqmmwoqn4qcemc9nawzadd1r&force=true" \
  -H "Authorization: Bearer <TOKEN>"
# Poll: GET /api/v1/deployments/<deployment_uuid> → status finished/failed
```
TOKEN is in auto-memory `bingo-deployment.md`. Schema changes auto-apply via `prisma db push` on boot.

---

## 7. Context window strategy
- **Fresh session**: read CLAUDE.md + SESSION_HANDOFF.md + CURRENT_TASK.md → 5-line summary → work.
- **After each task**: update SESSION_HANDOFF.md + CURRENT_TASK.md + auto-memory.
- Keep all three docs tight — they ARE the cross-session memory.
