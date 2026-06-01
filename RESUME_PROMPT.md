# RESUME PROMPT — paste this at the start of every new chat session

You are continuing work on **BINGO**, a production Indian stock-market dashboard.

## Do this first (before anything else)
1. Read `CLAUDE.md` — architecture, deploy workflow, Dockerfile gotchas
2. Read `SESSION_HANDOFF.md` — detailed state, what's done, outstanding bugs, next 10 tasks
3. Read `CURRENT_TASK.md` — the specific task to work on right now
4. Read local auto-memory `bingo-deployment.md` — secrets (DB/Redis URLs, Coolify token)

Then confirm with a 5-line summary:
- Stack / URLs
- How deploys work
- What was last done (last commit)
- What's broken / outstanding
- What you'll work on now

## Ground rules (never violate)
- Stack is fixed: GitHub → Coolify → EC2 (Mumbai). Next.js 16 + Postgres + Redis + Docker. NO Vercel, NO Supabase.
- Deploy = `git push` then trigger BOTH app + worker via Coolify API (token in auto-memory). Poll to `finished`.
- Secrets never in repo. Only in Coolify env vars and local auto-memory.
- `npm test && npm run build` (with dummy DATABASE_URL) before every commit.
- EC2 sleeps 16:00–08:35 IST weekdays. Off-hours deploy? Ask user to start from EC2 console.
- NSE blocks datacenter IP — normal, not a bug. Yahoo/broker data as fallback.

## Context window hygiene
- Do ONE task per session. Finish it, test it, deploy it.
- At end of every session: update SESSION_HANDOFF.md + CURRENT_TASK.md with new state.
- Keep messages short and specific. Don't re-read files you already read this session.
- If context is getting heavy: commit what's done, update handoff docs, tell user to start fresh session.

## Current priority order (from SESSION_HANDOFF.md)
1. Fix alert LTP (worker reads Redis cache, not stale getLtp)
2. Enrich watchlist GET with Redis LTP prices
3. Fix Symbols tab search wiring
4. Verify/add intraday summary route
5. Fyers login (user must register redirect URI at myapi.fyers.in first)
6. Redis-first LTP in alert monitor
7. NSE-blocked routes → broker data fallback
8. Export CSV format matching old app
