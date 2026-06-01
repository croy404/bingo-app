# CURRENT_TASK.md — paste this into a new session to pick up mid-task

## Project
BINGO Indian market dashboard. Stack: Next.js 16 + Postgres + Redis + Docker → Coolify → EC2.
Live at https://maxcap.co.in. Repo: croy404/bingo-app. Local: C:\Users\cweb4\Downloads\bingo-next

## What was just deployed (commit 63cfb8b, 2026-06-01)
- NSE-blocked routes fixed: all five market routes (nifty50, breadth, screener, 52week, sector-rotation)
  now use shared getNifty50Data() in lib/market-data.ts:
  1. Redis cache check (key nifty50_data, 5 min TTL)
  2. NSE API attempt
  3. Yahoo Finance v7/finance/quote batch fallback (all 50 symbols in one request)
- Dashboard heatmap, breadth bar, screener, 52-week, sector-rotation now all work from EC2

## Previous commit (95a1a9e)
- Alert LTP: Redis-first, getLtp(force:true) fallback
- Watchlist: Redis-enriched LTP, 30s auto-refresh
- Alerts: camelCase bug fixed, LTP+distance% in table
- Intraday summary route created
- Symbols search fixed

## Next task to work on
**Mobile navigation** — the sidebar is `hidden md:flex` so on phones/tablets there's no way
to navigate between pages. Need to add a mobile bottom tab bar or hamburger drawer.

Recommended approach (bottom tab bar, 5 most-used pages):
- Dashboard, Watchlist, Portfolio, Alerts, More (opens a drawer with remaining pages)
- Fixed to bottom of screen: `fixed bottom-0 left-0 right-0 z-40 flex md:hidden`
- "More" item opens a slide-up sheet with the full nav list

File to edit: `app/page.tsx` — add `MobileNav` component + `MobileDrawer` state.

## Before committing
Run: `npm test && DATABASE_URL="postgres://u:p@localhost:5432/db" npm run build`
Deploy: push to main + Coolify API (token in auto-memory bingo-deployment.md)
App UUID: ggkyez6sftnzxqhq1jku14f2 (no worker deploy needed for UI-only changes)
