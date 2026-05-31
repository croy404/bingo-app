/**
 * BINGO Background Worker — always-on process (runs in its own container)
 *
 * Responsibilities:
 *   - Alert monitor: checks active alerts every 30s during market hours,
 *     fires Telegram + WhatsApp notifications, respects cooldowns.
 *   - Morning brief: 08:30 IST weekdays → AI-generated, sent to Telegram.
 *   - EOD P&L summary: 15:35 IST weekdays → intraday realised P&L to Telegram.
 *   - Broker price streaming: when a broker session exists, polls LTP for
 *     watchlist + portfolio symbols into Redis so the web app reads them fast.
 *
 * This is the piece serverless/Vercel could NOT do (no persistent process).
 */
import { prisma } from "../lib/db";
import { redis, cacheSet } from "../lib/redis";
import { askAI } from "../lib/ai-provider";
import { getLtp } from "../lib/ltp";
import { isMarketHours, isAppActive, istNow, istToday, NSE_HOLIDAYS } from "../lib/market-data";
import { fetchNseAnnouncements, fetchBseAnnouncements, ingestFilings, watchlistFilter, type NewFiling } from "../lib/filings";
import { getSession as fyersSession, toFyersSymbol } from "../lib/broker-fyers";
import { getSession as iciciSession } from "../lib/broker-icici";
import { startFyersStream, stopFyersStream } from "../lib/fyers-ws";
import { startBreezeStream, stopBreezeStream } from "../lib/breeze-ws";
import { downloadAll as downloadSymbols, getExchangeToken } from "../lib/symbols";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...a);

async function getConfig() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

async function sendTelegram(text: string) {
  const cfg = await getConfig();
  if (!cfg.tg_token || !cfg.tg_chat_id) return;
  try {
    await fetch(`https://api.telegram.org/bot${cfg.tg_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.tg_chat_id, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    log("telegram send failed", e);
  }
}

async function sendWhatsApp(text: string) {
  const cfg = await getConfig();
  if (!cfg.wa_phone || !cfg.wa_apikey) return;
  try {
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${cfg.wa_phone}&text=${encodeURIComponent(text)}&apikey=${cfg.wa_apikey}`);
  } catch { /* non-fatal */ }
}

// ─── Alert Monitor ────────────────────────────────────────────────────────────
let alertRunning = false;
async function checkAlerts() {
  if (alertRunning) return;
  if (!isMarketHours()) return;
  alertRunning = true;
  try {
    const alerts = await prisma.alert.findMany({ where: { isActive: true }, take: 500 });
    for (const alert of alerts) {
      try {
        const q = await getLtp(alert.symbol, alert.exchange);
        const ltp = q.ltp;
        if (!ltp) continue;
        const c = alert.condition, p = alert.price;
        const triggered = (c === ">" && ltp > p) || (c === ">=" && ltp >= p) || (c === "<" && ltp < p) || (c === "<=" && ltp <= p);
        if (!triggered) continue;
        if (alert.lastTriggeredAt && Date.now() - alert.lastTriggeredAt.getTime() < (alert.cooldownMins ?? 5) * 60000) continue;

        await prisma.alertHistory.create({ data: { alertId: alert.id, symbol: alert.symbol, exchange: alert.exchange, condition: c, targetPrice: p, triggeredLtp: ltp } });
        await prisma.alert.update({
          where: { id: alert.id },
          data: { triggeredCount: alert.triggeredCount + 1, lastTriggeredAt: new Date(), ...(alert.alertType === "once" ? { isActive: false } : {}) },
        });
        const dir = c === ">" || c === ">=" ? "crossed above" : "dropped below";
        const msg = `⚡ <b>Alert Triggered!</b>\n📊 <b>${alert.symbol}</b> · ${alert.exchange}\n💵 LTP: ₹${ltp.toFixed(2)} ${dir} ₹${p}\n📡 ${q.source}\n🕐 ${istNow().toISOString().slice(11, 16)} IST`;
        await sendTelegram(msg);
        await sendWhatsApp(`BINGO Alert: ${alert.symbol} ${c} ${p} | LTP ${ltp.toFixed(2)}`);
        log("alert fired", alert.symbol, c, p, "ltp", ltp);
      } catch (e) {
        log("alert check error", alert.symbol, e);
      }
    }
  } finally {
    alertRunning = false;
  }
}

// ─── Broker price streaming → Redis ────────────────────────────────────────────
async function streamPrices() {
  // Only fetch live prices inside the app-active window (08:55–15:45 IST, trading days).
  if (!isAppActive()) { stopFyersStream(); stopBreezeStream(); return; }
  try {
    const [wl, port] = await Promise.all([
      prisma.watchlist.findMany({ select: { symbol: true, exchange: true } }),
      prisma.portfolio.findMany({ select: { symbol: true, exchange: true } }),
    ]);
    const seen = new Set<string>();
    const symbols = [...wl, ...port].filter((s) => {
      const k = `${s.exchange}:${s.symbol}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (!symbols.length) return;

    // 1. ICICI Breeze connected → Socket.IO real-time ticks (token from Shoonya master).
    const icici = await iciciSession();
    if (icici) {
      stopFyersStream();
      const items: { symbol: string; exchange: string; token: string }[] = [];
      for (const s of symbols) {
        const token = await getExchangeToken(s.symbol, s.exchange);
        if (token) items.push({ symbol: s.symbol, exchange: s.exchange, token });
      }
      if (items.length) startBreezeStream(icici, items);
      // Yahoo-fill any symbols without a token (e.g. F&O) so they're not blank
      const tokenless = symbols.filter((s) => !items.find((i) => i.symbol === s.symbol && i.exchange === s.exchange));
      for (const s of tokenless) { const q = await getLtp(s.symbol, s.exchange, { force: true }); if (q.ltp > 0) await cacheSet(`price:${s.exchange}:${s.symbol}`, q, 86400); }
      return;
    }

    // 2. Fyers connected → WebSocket ticks.
    const fy = await fyersSession();
    if (fy) {
      stopBreezeStream();
      startFyersStream(fy, symbols.map((s) => toFyersSymbol(s.exchange, s.symbol)));
      return;
    }

    // 3. No broker → 30s Yahoo REST polling.
    stopFyersStream(); stopBreezeStream();
    for (const s of symbols) {
      const q = await getLtp(s.symbol, s.exchange, { force: true });
      if (q.ltp > 0) await cacheSet(`price:${s.exchange}:${s.symbol}`, q, 86400);
    }
    log("polled", symbols.length, "prices to redis");
  } catch (e) {
    log("price stream error", e);
  }
}

// ─── Symbol master download (queued from the UI) ──────────────────────────────
let symbolDownloadRunning = false;
async function checkSymbolDownload() {
  if (symbolDownloadRunning) return;
  const req = await prisma.setting.findUnique({ where: { key: "symbols_download_req" } });
  if (!req?.value) return;
  symbolDownloadRunning = true;
  let exchanges: string[] = [];
  try { exchanges = JSON.parse(req.value).exchanges ?? []; } catch { /* ignore */ }
  // Consume the request immediately so we don't double-run
  await prisma.setting.deleteMany({ where: { key: "symbols_download_req" } });
  await prisma.setting.upsert({ where: { key: "symbols_download_status" },
    create: { key: "symbols_download_status", value: JSON.stringify({ state: "running", exchanges }) },
    update: { value: JSON.stringify({ state: "running", exchanges }) } });
  log("symbol download starting:", exchanges.join(","));
  try {
    const result = await downloadSymbols(exchanges);
    await prisma.setting.upsert({ where: { key: "symbols_download_status" },
      create: { key: "symbols_download_status", value: JSON.stringify({ state: "done", result, at: new Date().toISOString() }) },
      update: { value: JSON.stringify({ state: "done", result, at: new Date().toISOString() }) } });
    log("symbol download done:", JSON.stringify(result));
  } catch (e) {
    await prisma.setting.upsert({ where: { key: "symbols_download_status" },
      create: { key: "symbols_download_status", value: JSON.stringify({ state: "error", error: String(e) }) },
      update: { value: JSON.stringify({ state: "error", error: String(e) }) } });
    log("symbol download error", e);
  } finally {
    symbolDownloadRunning = false;
  }
}

// ─── Filings monitor (NSE/BSE corporate announcements) — ALWAYS ON ─────────────
// One lightweight HTTP call per exchange. New filings are deduped in the DB and
// pushed to Telegram. Off-hours filings (e.g. results at 6pm) are caught on the
// next poll; any backlog from non-working hours is delivered automatically since
// dedupe is by content, not by time. Filtered to the watchlist when one exists.
async function checkFilings() {
  try {
    const [nse, bse] = await Promise.all([fetchNseAnnouncements(), fetchBseAnnouncements()]);
    let all: NewFiling[] = [...nse, ...bse];
    const filter = await watchlistFilter();
    if (filter) all = all.filter((f) => f.symbol && filter.has(f.symbol.toUpperCase()));
    const fresh = await ingestFilings(all);
    if (!fresh.length) return;
    // Notify (cap to avoid spamming if a big backlog lands at once)
    for (const f of fresh.slice(0, 15)) {
      const head = `📄 <b>${f.exchange} Filing</b>${f.symbol ? ` · <b>${f.symbol}</b>` : ""}`;
      const body = [f.company, f.category, f.subject].filter(Boolean).join("\n");
      const link = f.attachment ? `\n🔗 ${f.attachment}` : "";
      await sendTelegram(`${head}\n${body}${link}`);
    }
    // Mark notified
    await prisma.filing.updateMany({ where: { dedupeKey: { in: fresh.map((f) => f.dedupeKey) } }, data: { notified: true } });
    log("filings: notified", Math.min(fresh.length, 15), "of", fresh.length, "new");
  } catch (e) {
    log("filings error", e);
  }
}

// ─── Scheduled jobs (morning brief, EOD P&L) ───────────────────────────────────
let lastBriefDate = "";
let lastEodDate = "";

// Persisted "ran today" markers survive restarts (instance stop/start) via settings table.
async function alreadyRan(key: string, today: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value === today;
}
async function markRan(key: string, today: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value: today }, update: { value: today } });
}

async function runMorningBrief() {
  const ist = istNow();
  const today = istToday();
  if (lastBriefDate === today) return;
  if (ist.getUTCDay() === 0 || ist.getUTCDay() === 6) return;
  if (NSE_HOLIDAYS.has(today.replace(/-/g, ""))) return;
  const t = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  // Fire any time from 08:25 up to market close — so a boot at 08:40 still triggers it.
  if (t < 8 * 60 + 25 || t >= 15 * 60 + 30) return;
  if (await alreadyRan("ran_morning_brief", today)) { lastBriefDate = today; return; }
  lastBriefDate = today;
  await markRan("ran_morning_brief", today);
  try {
    const fii = await prisma.fiiDiiHistory.findFirst({ orderBy: { date: "desc" } });
    const fiiLine = fii ? `FII ₹${((fii.fiiNet ?? 0) / 100).toFixed(0)}Cr, DII ₹${((fii.diiNet ?? 0) / 100).toFixed(0)}Cr` : "";
    const r = await askAI(
      `Pre-market Indian market brief. ${fiiLine}. Nifty outlook, key sectors, 2 stocks to watch, 1 risk. 5 bullets, max 180 words.`,
      "You are a senior Indian equity analyst.", 400, "market_insight");
    await sendTelegram(`🌅 <b>BINGO Morning Brief — ${today}</b>\n━━━━━━━━━━━━━━\n${r.text}\n\n<i>via ${r.provider}</i>`);
    log("morning brief sent");
  } catch (e) {
    log("morning brief failed", e);
  }
}

async function runEodPnl() {
  const ist = istNow();
  const today = istToday();
  if (lastEodDate === today) return;
  if (ist.getUTCDay() === 0 || ist.getUTCDay() === 6) return;
  if (NSE_HOLIDAYS.has(today.replace(/-/g, ""))) return;
  const t = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  // Fire any time from 15:35 onward (so it sends before the 16:00 instance stop).
  if (t < 15 * 60 + 35) return;
  if (await alreadyRan("ran_eod_pnl", today)) { lastEodDate = today; return; }
  lastEodDate = today;
  await markRan("ran_eod_pnl", today);
  try {
    const trades = await prisma.intradayTrade.findMany({ where: { tradeDate: new Date(today) } });
    if (!trades.length) return;
    const lots: Record<string, { qty: number; price: number }[]> = {};
    const realised: Record<string, number> = {};
    let turnover = 0;
    for (const t of trades) {
      const k = t.symbol; turnover += t.qty * t.price;
      lots[k] ??= []; realised[k] ??= 0;
      if (t.side === "BUY") lots[k].push({ qty: t.qty, price: t.price });
      else { let rem = t.qty; while (rem > 0 && lots[k].length) { const lot = lots[k][0]; const u = Math.min(rem, lot.qty); realised[k] += u * (t.price - lot.price); lot.qty -= u; rem -= u; if (lot.qty <= 0) lots[k].shift(); } }
    }
    const total = Object.values(realised).reduce((s, p) => s + p, 0);
    const wins = Object.values(realised).filter((p) => p > 0).length;
    const losers = Object.values(realised).filter((p) => p < 0).length;
    await sendTelegram(`📊 <b>EOD P&L Summary — ${today}</b>\n━━━━━━━━━━━━━━\n${total >= 0 ? "🟢" : "🔴"} Net: ₹${total.toFixed(2)}\nTrades: ${trades.length} | W:${wins} L:${losers}\nTurnover: ₹${turnover.toFixed(0)}`);
    log("eod pnl sent");
  } catch (e) {
    log("eod pnl failed", e);
  }
}

// ─── Main loops ────────────────────────────────────────────────────────────────
async function main() {
  log("BINGO worker starting…");
  try { await redis.ping(); log("redis connected"); } catch (e) { log("redis NOT connected", e); }
  try { await prisma.$queryRaw`SELECT 1`; log("postgres connected"); } catch (e) { log("postgres NOT connected", e); }

  // Alert monitor + price streaming every 30s (self-gate to active window inside)
  setInterval(() => { void checkAlerts(); }, 30_000);
  setInterval(() => { void streamPrices(); }, 30_000);
  // Schedule checks every minute
  setInterval(() => { void runMorningBrief(); void runEodPnl(); }, 60_000);
  // Filings monitor — ALWAYS ON, every 15 min (cheap: one request per exchange).
  // Catches after-hours filings and delivers any overnight backlog automatically.
  setInterval(() => { void checkFilings(); }, 15 * 60_000);
  // Symbol-master download requests (queued from the UI) — check every 20s.
  setInterval(() => { void checkSymbolDownload(); }, 20_000);

  // Kick off immediately (filings catch-up runs on every (re)start too)
  void checkAlerts();
  void streamPrices();
  void checkFilings();
  void checkSymbolDownload();

  log("worker running — alerts (30s), price stream (30s, gated 08:55–15:45), schedulers (60s), filings (15m, always-on)");
}

main().catch((e) => { log("fatal", e); process.exit(1); });

// Graceful shutdown
process.on("SIGTERM", async () => { log("SIGTERM — shutting down"); await prisma.$disconnect(); await redis.quit(); process.exit(0); });
process.on("SIGINT", async () => { log("SIGINT — shutting down"); await prisma.$disconnect(); await redis.quit(); process.exit(0); });
