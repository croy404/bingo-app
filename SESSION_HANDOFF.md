# SESSION HANDOFF — BINGO App

Detailed state for the next session. Read `CLAUDE.md` first for the quick guide.
**Last updated:** 2026-05-31, end of a long build session. Everything below is the TRUE current state (the project is in a good, working condition — there is NO active blocking bug).

---

## 1. Current project architecture
- **GitHub → Coolify → AWS EC2 (Mumbai, ap-south-1)**, single t3.medium box, Elastic IP `13.203.185.106`.
- Two Coolify resources from one repo (`croy404/bingo-app`, branch `main`):
  - **Web app** — `/Dockerfile`, Next.js 16 standalone, port 3000, domain `https://maxcap.co.in`. UUID `ggkyez6sftnzxqhq1jku14f2`.
  - **Worker** — `/Dockerfile.worker`, runs `worker/index.ts` via tsx, no domain (shows red/unhealthy in Coolify — cosmetic, it has no web port). UUID `jqmmwoqn4qcemc9nawzadd1r`.
- **Postgres 16** + **Redis 7** are separate Coolify database resources on the same box.
- Stack: Next.js 16, TypeScript, Prisma, ioredis, Docker, fflate, socket.io-client, ws, openai.

## 2. What has been completed (everything from the original Replit app is ported)
- Dashboard: indices (Yahoo, incl. global), Nifty50 heatmap, FII/DII, market breadth, news (RSS)
- Portfolio: holdings CRUD, live P&L, per-holding + portfolio XIRR, sector allocation, **benchmark vs Nifty**, **daily snapshots**
- **SIP tracker**: entries + instalment transactions + XIRR performance (own tab)
- Intraday trade log with FIFO P&L + equity curve
- Journal + daily notes + emotion/setup tagging
- Alerts: create/toggle/delete, history, **backtest**, cooldowns, recurring
- Options chain + PCR
- Screener: gainers/losers, **52-week high/low**, **volume surge**, sector rotation
- **Symbol master: 148k symbols from Shoonya** (NSE/BSE/NFO/BFO/MCX/CDS) + search
- **CSV export** (portfolio/journal/intraday/alerts)
- **AI: 4-provider fallback** (Groq→Cerebras→OpenRouter→Anthropic) + UI buttons (market summary, risk score, journal analysis, trade ideas) + Telegram AI commands
- **Telegram bot**: full command set (/status /alerts /portfolio /ltp /brief /research /risk /ideas /week /bracket etc.) + webhook
- **NSE/BSE filings monitor** (always-on, 15 min, dedupe, Telegram push) + Filings tab
- Morning brief (08:30 IST) + EOD P&L (15:35 IST), restart-robust
- **Broker login: ICICI Breeze + Fyers** (OAuth auto-capture + manual token; creds saved)
- **Broker real-time WebSocket streaming: ICICI Breeze (Socket.IO) + Fyers (HSM WS)** → Redis
- HTTPS custom domain (maxcap.co.in) + Let's Encrypt
- Cost optimization: scheduled stop/start (~$14/mo)

## 3. Files / structure
- `app/page.tsx` — entire single-page UI (tabs: dashboard, portfolio, sip, intraday, watchlist, options, screener, journal, alerts, filings, news, brokers, symbols, settings) + inline `SipTx` component + AI result panel
- `app/api/**/route.ts` — ~55 routes (market, portfolio, sip, intraday, journal, alerts, options, screener, symbols, ai, broker/{icici,fyers}, telegram, cron, filings, export, health, dashboard, settings, watchlist)
- `lib/` — `db.ts`, `redis.ts`, `market-data.ts` (gating, xirr, sectors), `ltp.ts` (unified resolver), `ai-provider.ts`, `broker-icici.ts` (uses node:https for GET+body), `broker-fyers.ts`, `breeze-ws.ts`, `fyers-ws.ts`, `symbols.ts` (Shoonya), `filings.ts`
- `worker/index.ts` — alert monitor (30s), price stream/WS (30s, gated), schedulers (60s), filings (15m), symbol-download flag (20s)
- `prisma/schema.prisma` — 15 models incl. `Filing`, `Symbol`, `BrokerSession`, `Setting`
- `Dockerfile`, `Dockerfile.worker`, `docker-compose.yml` (local dev), `tests/market-data.test.ts`, `.github/workflows/ci.yml`

## 4. Current deployment setup
- Deploy via **Coolify API** (NOT GitHub webhook — see CLAUDE.md). Token in local auto-memory.
- Coolify localhost server IP = `host.docker.internal` (critical — see CLAUDE.md).
- Env vars set in Coolify on both resources: DATABASE_URL, REDIS_URL, CRON_SECRET, NODE_ENV. AI keys NOT yet set.
- Stop/start: cron stop 16:00 IST + EventBridge start 08:35 IST. Box is OFF outside weekday 08:35–16:00 IST → deploys need the box awake (start it from EC2 console for off-hours work).

## 5. Outstanding issues (none blocking; mostly user-side config)
- **Fyers login** still returns `redirectUrl mismatch`. Fix is user-side: at myapi.fyers.in set Redirect URI to exactly `https://maxcap.co.in/api/broker/fyers/callback`, **Save**, and open the app via `https://maxcap.co.in` (not the sslip.io URL) so the generated redirect matches.
- **ICICI** logs in fine; live streaming only verifiable during market hours (08:55–15:45 IST) with symbols in watchlist/portfolio.
- **NSE-direct routes** (`market/nifty50`, `market/breadth`, `market/screener`, `market/52week`, `market/sector-rotation`, `options`) are blocked by NSE from the datacenter IP (HTML block page). They work once a broker is connected (broker data) — or during market hours. Yahoo-backed routes (indices, quotes, fii-dii, news) always work.
- AI buttons need a `GROQ_API_KEY` (free) added to Coolify env vars.

## 6. Current bug being investigated
**None.** Last items were all resolved: webhook→Coolify-API deploys, server-IP SSH timeout (fixed to host.docker.internal), ICICI GET-with-body (fixed via node:https), domain+HTTPS, symbol master, both broker WebSockets. The app is healthy (`/api/health` → postgres+redis connected).

## 7. Next 10 tasks in priority order
1. Help the user finish **Fyers login** (verify redirect URI saved + app opened via maxcap.co.in) and confirm a successful connect.
2. During market hours, **verify live streaming** flows: connect ICICI or Fyers, add a watchlist symbol, confirm `price:NSE:<SYM>` updates in Redis and the UI shows live ticks.
3. Add **GROQ_API_KEY** to Coolify (guide user) and confirm AI buttons return results.
4. Add **BFO** to the symbol download and confirm counts.
5. Make NSE-direct routes fall back to broker data when a broker is connected (so heatmap/breadth/screener populate even from the datacenter IP).
6. Add a tiny **/api/stream/status** + UI badge showing which broker WS is live and tick freshness.
7. Persist **Fyers app credentials** (like ICICI) so re-login only needs the token.
8. Add **alert sound / browser push** on trigger (optional).
9. Consider re-enabling **GitHub webhook auto-deploy** properly (fix the webhook secret on bingo-app1) so the Coolify-API workaround isn't needed — low priority.
10. General polish: loading states, error toasts, mobile layout pass.

## 8. Environment variables required
In Coolify, both app + worker: `DATABASE_URL`, `REDIS_URL`, `CRON_SECRET=bingo_cron_secret_2026`, `NODE_ENV=production`.
Optional AI: `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`.
(Actual DB/Redis connection strings + Coolify API token are in the LOCAL auto-memory file, not this repo.)

## 9. AWS / Coolify configuration already done
- EC2 t3.medium ap-south-1, Elastic IP 13.203.185.106, 30GB disk, 4GB swap.
- Security group: SSH(22)=home IP, HTTP(80)+HTTPS(443)+8000=0.0.0.0/0.
- Coolify installed; GitHub App `bingo-app1` connected (clones fine; webhook unreliable).
- Postgres 16 + Redis 7 running as Coolify resources.
- App + worker resources created and deploying.
- DNS: maxcap.co.in A `@` → 13.203.185.106; HTTPS via Let's Encrypt.
- Cron stop 16:00 IST (`/etc/cron.d/bingo-stop`); EventBridge `bingo-start` 08:35 IST (role `bingo-scheduler-ec2-start`); shutdown behavior = Stop.
- ICICI portal redirect already `https://maxcap.co.in/api/broker/icici/oauth-callback`.

## 10. Instructions for the next Claude (Sonnet) session
- Read `CLAUDE.md` + this file fully before changing anything. The local auto-memory file also has secrets + the same context.
- To deploy: `git push` then trigger BOTH app + worker via the Coolify API (CLAUDE.md), poll status to `finished`. Don't wait on the GitHub webhook.
- Always `npm test && npm run build` (with a dummy DATABASE_URL) before committing.
- The box may be asleep outside weekday 08:35–16:00 IST — if SSH/deploy fails, ask the user to start the instance from the EC2 console.
- For live-data work, NSE blocks the datacenter IP; prefer Yahoo or broker data.
- Be careful editing the two Dockerfiles — see the "gotchas" in CLAUDE.md (several hard-won fixes).
