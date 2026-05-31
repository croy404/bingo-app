# BINGO — Indian Market Dashboard (project guide for AI sessions)

A full-featured Indian stock-market dashboard (NSE/BSE), self-hosted on AWS.
This file is read at the start of every session — keep it accurate and concise.

## Architecture
**GitHub → Coolify → AWS EC2.** No Vercel, no Supabase, no serverless.
- **Next.js 16 + TypeScript** web app (`/Dockerfile`, port 3000) — serves UI + all `/api/*` routes
- **Background worker** (`/Dockerfile.worker`, `worker/index.ts`) — always-on: alert monitor, broker WebSocket streaming, filings monitor, morning brief, EOD P&L, symbol downloads
- **PostgreSQL 16** via **Prisma** (`prisma/schema.prisma`, `lib/db.ts`)
- **Redis 7** via ioredis (`lib/redis.ts`) — price cache + scheduler markers
- **Coolify** orchestrates both containers on a single EC2 box

## Live URLs / infra
- App: **https://maxcap.co.in** (GoDaddy domain → EC2 EIP, Coolify Traefik + Let's Encrypt SSL)
- EC2: t3.medium, Ubuntu 24.04, **ap-south-1 (Mumbai)**, Elastic IP **13.203.185.106**
- Coolify dashboard: http://13.203.185.106:8000
- SSH: `ssh -i C:\Users\cweb4\Downloads\BINGO.pem ubuntu@13.203.185.106` (docker needs `sudo`)
- Repo: `croy404/bingo-app`, branch `main`. Local: `C:\Users\cweb4\Downloads\bingo-next`

## Deploy workflow (IMPORTANT — do not rely on GitHub webhook)
The GitHub App webhook auto-deploy is **broken** (secret mismatch from a recreated app). Deploy via the **Coolify API** instead. After every `git push`:
```
curl -X POST "http://13.203.185.106:8000/api/v1/deploy?uuid=<UUID>&force=true" -H "Authorization: Bearer <COOLIFY_TOKEN>"
```
- App UUID: `ggkyez6sftnzxqhq1jku14f2`  ·  Worker UUID: `jqmmwoqn4qcemc9nawzadd1r`
- `force=true` rebuilds from latest main (`force=false` skips if commit unchanged)
- Poll: `GET /api/v1/deployments/<deployment_uuid>` → status `finished` | `failed` | `in_progress`
- **The COOLIFY_TOKEN, DB/Redis connection strings, and other secrets are in the local auto-memory file** (`bingo-deployment.md`), NOT in this repo. Ask the user if not present.

## Build / test discipline (do this before every commit)
```
npm test                                    # node:test via tsx, 3 tests
DATABASE_URL="postgres://u:p@localhost:5432/db" npm run build   # prisma generate + next build
```
Then commit + push + trigger Coolify deploy (both app and worker).

## Dockerfile gotchas (already solved — don't regress)
- `npm ci --include=dev` (Coolify injects NODE_ENV=production which would skip build tooling)
- Do NOT set `NODE_ENV=development` for `next build` (breaks `/_not-found` prerender)
- `public/` dir must exist (Docker COPY)
- Runner keeps FULL node_modules so the Prisma CLI's transitive deps (e.g. `effect`) exist
- Coolify **localhost server IP must be `host.docker.internal`** (NOT the public IP) or deploys fail with `ssh ... port 22 timed out` (port 22 is firewalled to home IP)

## Cost optimization (stop/start)
- Instance auto-stops 16:00 IST (cron `/etc/cron.d/bingo-stop`), auto-starts 08:35 IST (EventBridge `bingo-start`). Shutdown behavior must stay **Stop**. ~$14/mo.
- **Deploys only work while the box is awake** (weekdays 08:35–16:00 IST) — or start it manually from the EC2 console.

## Market-hours gating
- App + LTP active **08:55–15:45 IST on trading days** (`isAppActive` in `lib/market-data.ts`). Off-hours serve last-close from Redis, no external API calls.
- Filings monitor is **always-on** (every 15 min). Alerts fire 09:15–15:30 IST.

## Real-time streaming (worker)
During the active window, `streamPrices()` picks: **ICICI Breeze WS** (`lib/breeze-ws.ts`, Socket.IO, tokens from Shoonya master) → else **Fyers WS** (`lib/fyers-ws.ts`) → else Yahoo polling. Ticks → Redis `price:EXCHANGE:SYMBOL`.

## Symbol master
148k symbols from **Shoonya** zipped CSVs (NSE/BSE/NFO/BFO/MCX/CDS), parsed with fflate. Download runs in the worker via the `symbols_download_req` settings flag (NFO/BFO are huge). NSE/BSE tokens == Breeze stream tokens.

## Env vars (set in Coolify on BOTH app + worker)
`DATABASE_URL`, `REDIS_URL`, `CRON_SECRET=bingo_cron_secret_2026`, `NODE_ENV=production`. Optional for AI: `GROQ_API_KEY` (free), `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`.

## See also
- `SESSION_HANDOFF.md` — detailed current state, what's done, outstanding items, next tasks
- Commit trailer: `Co-Authored-By: Claude ...`
