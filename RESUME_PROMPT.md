# RESUME PROMPT — paste this into a fresh Sonnet session

You are continuing work on **BINGO**, a production Indian stock-market dashboard. The previous session (Opus) handed off here. Do this first, before anything else:

1. Read these three files in full, in order:
   - `CLAUDE.md` (project guide: architecture, deploy workflow, gotchas)
   - `SESSION_HANDOFF.md` (detailed state, outstanding items, next 10 tasks)
   - Your local auto-memory file `bingo-deployment.md` (has the secrets: DB/Redis URLs, Coolify API token, SSH key path — these are NOT in the repo)
2. Confirm you've read them by giving me a 5-line summary of: the stack, how deploys work, what's done, what's outstanding, and the very next task.

## Ground rules (do not violate)
- **Stack is fixed:** GitHub → Coolify → AWS EC2 (Mumbai). Next.js 16 + TypeScript + Postgres + Redis + Docker + Coolify worker. **NO Vercel, NO Supabase, NO serverless.**
- **Deploy = `git push` then trigger BOTH app + worker via the Coolify API** (token in auto-memory). Do NOT rely on the GitHub webhook — it's unreliable here. Poll deployment status to `finished`.
- **Secrets never go in the repo** (`croy404/bingo-app` is public). They live only in local auto-memory.
- Before every commit: `npm test` and `npm run build` (use a dummy `DATABASE_URL` env for build). Then commit, push, deploy.
- The EC2 box auto-stops outside weekday 08:35–16:00 IST. If a deploy/SSH fails off-hours, ask me to start the instance from the EC2 console.
- NSE blocks the datacenter IP for some direct routes — prefer Yahoo or broker data; don't treat those 403/HTML responses as bugs.

## Where to start
Unless I say otherwise, start with the top of the "Next 10 tasks" list in `SESSION_HANDOFF.md`:
1. Help me finish **Fyers login** (redirect URI at myapi.fyers.in must be exactly `https://maxcap.co.in/api/broker/fyers/callback`, saved, and I must open the app via maxcap.co.in).
2. Then verify **live broker streaming** during market hours.
3. Then add **GROQ_API_KEY** to Coolify for AI features.

Ask me which one to tackle first, or proceed top-down if I tell you to "just continue."
