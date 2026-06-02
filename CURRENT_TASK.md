# CURRENT_TASK.md — paste this into a new session to pick up mid-task

## Project
BINGO Indian market dashboard. Stack: Next.js 16 + Postgres + Redis + Docker → Coolify → EC2.
Live at https://maxcap.co.in. Repo: croy404/bingo-app. Local: C:\Users\cweb4\Downloads\bingo-next

## Current state (commit 3097fcc, 2026-06-01) — BUILD COMPLETE
The app is fully built and deployed. All major features from the HyperTrader V3.2 spec are live:
- All 15+ pages working (dashboard, watchlist, portfolio, alerts, screener, journal, etc.)
- Mobile nav, theme system, AI chat panel, risk calculator, notepad
- Correlation matrix, portfolio tabs (sectors + benchmark), dashboard stats
- NSE-blocked routes all have Yahoo Finance fallbacks
- SSE real-time price stream, Redis-enriched watchlist/alerts
- Worker: morning brief, EOD P&L, filings monitor, alert monitor

## Outstanding (minor, no user-visible bugs)
1. **Fyers login** — user must register redirect URI at myapi.fyers.in:
   `https://maxcap.co.in/api/broker/fyers/callback`
   This is a user action, not a code fix.

2. **ICICI Security Master** — non-Nifty-50 stocks may fail WS subscription (wrong stock code).
   Low impact — Nifty 50 covered by static SYMBOL_OVERRIDES map.

3. **GitHub webhook** — broken (Coolify API deploy works fine, no urgency).

## If user asks for something new
Read SESSION_HANDOFF.md for full feature list and file map before making changes.

## Deploy workflow (quick ref)
```
git push origin main
curl -X POST "http://13.203.185.106:8000/api/v1/deploy?uuid=ggkyez6sftnzxqhq1jku14f2&force=true" \
  -H "Authorization: Bearer 1|gsX52QEHFfmUXA1QGEM2vP3Mt4gTWPBNVh0hBD6x694d67d2"
curl -X POST "http://13.203.185.106:8000/api/v1/deploy?uuid=jqmmwoqn4qcemc9nawzadd1r&force=true" \
  -H "Authorization: Bearer 1|gsX52QEHFfmUXA1QGEM2vP3Mt4gTWPBNVh0hBD6x694d67d2"
```
Token also in auto-memory bingo-deployment.md.
