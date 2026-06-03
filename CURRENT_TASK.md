# CURRENT_TASK.md — paste this into a new session to pick up mid-task

## Project
BINGO Indian market dashboard. Stack: Next.js 16 + Postgres + Redis + Docker → Coolify → EC2.
Live at https://13-203-185-106.sslip.io. Repo: croy404/bingo-app. Local: C:\Users\cweb4\Downloads\bingo-next

## Current state (commit after domain removal, 2026-06-01) — BUILD COMPLETE
The app is fully built and deployed. Custom domain maxcap.co.in has been removed.
App now runs on Coolify sslip.io only: https://13-203-185-106.sslip.io

## Outstanding (minor, no user-visible bugs)
1. **Fyers redirect URI** — must be updated at myapi.fyers.in to:
   `https://13-203-185-106.sslip.io/api/broker/fyers/callback`
   (Was maxcap.co.in — update in the Fyers developer portal)

2. **ICICI redirect URI** — must be updated at api.icicidirect.com to:
   `https://13-203-185-106.sslip.io/api/broker/icici/oauth-callback`
   (Was maxcap.co.in — update in the ICICI developer portal)
   The Brokers page now shows the correct URL dynamically based on window.location.origin.

3. **ICICI Security Master** — non-Nifty-50 stocks may fail WS subscription (low impact).

4. **GitHub webhook** — broken (Coolify API deploy works fine, no urgency).

## Deploy workflow (quick ref)
```
git push origin main
curl -X POST "http://13.203.185.106:8000/api/v1/deploy?uuid=ggkyez6sftnzxqhq1jku14f2&force=true" \
  -H "Authorization: Bearer 1|gsX52QEHFfmUXA1QGEM2vP3Mt4gTWPBNVh0hBD6x694d67d2"
curl -X POST "http://13.203.185.106:8000/api/v1/deploy?uuid=jqmmwoqn4qcemc9nawzadd1r&force=true" \
  -H "Authorization: Bearer 1|gsX52QEHFfmUXA1QGEM2vP3Mt4gTWPBNVh0hBD6x694d67d2"
```
Token also in auto-memory bingo-deployment.md.
