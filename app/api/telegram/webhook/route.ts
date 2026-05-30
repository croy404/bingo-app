import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { askAI } from "@/lib/ai-provider";
import { istToday } from "@/lib/market-data";
import { getLtp } from "@/lib/ltp";
export const dynamic = "force-dynamic";

async function send(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function getConfig() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

const COND_MAP: Record<string, string> = { ">": ">", "<": "<", ">=": ">=", "<=": "<=", "=>": ">=", "=<": "<=", "=": ">=" };

function parseAlert(text: string) {
  const tokens = text.trim().toUpperCase().split(/\s+/);
  let ci = -1, cond = "";
  for (let i = 0; i < tokens.length; i++) if (COND_MAP[tokens[i]]) { ci = i; cond = COND_MAP[tokens[i]]; break; }
  if (ci <= 0 || ci >= tokens.length - 1) return null;
  const price = parseFloat(tokens[ci + 1].replace(/,/g, ""));
  if (!price || price <= 0) return null;
  const before = tokens.slice(0, ci);
  let exchange = "NSE";
  const exchanges = new Set(["NSE", "BSE", "NFO", "MCX"]);
  if (before.length > 1 && exchanges.has(before[before.length - 1])) exchange = before.pop()!;
  return { symbol: before.join("-"), exchange, condition: cond, price };
}

export async function POST(req: Request) {
  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const cfg = await getConfig();
  const token = cfg.tg_token ?? "";
  if (!token || (cfg.tg_chat_id && cfg.tg_chat_id !== chatId)) return NextResponse.json({ ok: true });

  const reply = (t: string) => send(token, chatId, t);
  const cmd = text.split(" ")[0].toLowerCase();

  if (cmd === "/start" || cmd === "/help") {
    await reply("🤖 <b>BINGO Bot</b>\n/status /alerts /history /portfolio /watchlist /journal /pnl /note\n/ltp SYMBOL /delete SYMBOL /clear /bracket SYMBOL EXCH ABOVE BELOW\n/brief /research SYMBOL /risk /ideas /week\n\n📌 Create alert: <code>RELIANCE &gt; 2500</code>");
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/status") {
    const [ac, pc, wc] = await Promise.all([prisma.alert.count({ where: { isActive: true } }), prisma.portfolio.count(), prisma.watchlist.count()]);
    await reply(`📡 <b>BINGO Status</b>\n🔔 Active Alerts: <b>${ac}</b>\n📊 Portfolio: <b>${pc}</b>\n👁️ Watchlist: <b>${wc}</b>`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/alerts") {
    const rows = await prisma.alert.findMany({ where: { isActive: true }, take: 20 });
    const lines = rows.map(a => `• <b>${a.symbol}</b> ${a.condition} ₹${a.price}`);
    await reply(`🔔 <b>Active Alerts (${lines.length})</b>\n${lines.join("\n") || "None"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/history") {
    const rows = await prisma.alertHistory.findMany({ orderBy: { triggeredAt: "desc" }, take: 10 });
    const lines = rows.map(h => `• <b>${h.symbol}</b> ${h.condition} ₹${h.targetPrice} → ₹${h.triggeredLtp}`);
    await reply(`📋 <b>Alert History</b>\n${lines.join("\n") || "None"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/clear") {
    const c = await prisma.alert.count({ where: { isActive: true } });
    await prisma.alert.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await reply(`🗑️ Cleared <b>${c}</b> alerts`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/delete") {
    const sym = text.split(" ").slice(1).join(" ").toUpperCase();
    if (!sym) { await reply("Usage: /delete SYMBOL"); return NextResponse.json({ ok: true }); }
    const c = await prisma.alert.count({ where: { symbol: sym, isActive: true } });
    await prisma.alert.updateMany({ where: { symbol: sym, isActive: true }, data: { isActive: false } });
    await reply(`🗑️ Deactivated <b>${c}</b> alert(s) for ${sym}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/bracket") {
    const [sym, exch, aboveS, belowS] = text.split(" ").slice(1);
    if (!sym || !exch || !aboveS || !belowS) { await reply("Usage: /bracket SYMBOL EXCH ABOVE BELOW"); return NextResponse.json({ ok: true }); }
    const above = parseFloat(aboveS), below = parseFloat(belowS);
    await prisma.alert.createMany({ data: [
      { symbol: sym.toUpperCase(), exchange: exch.toUpperCase(), condition: ">", price: above, alertType: "once", remarks: "target" },
      { symbol: sym.toUpperCase(), exchange: exch.toUpperCase(), condition: "<", price: below, alertType: "once", remarks: "stop-loss" },
    ] });
    await reply(`✅ Bracket: ${sym} > ₹${above} | < ₹${below}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/portfolio") {
    const rows = await prisma.portfolio.findMany({ select: { symbol: true, qty: true, avgPrice: true } });
    const lines = rows.slice(0, 12).map(h => `• <b>${h.symbol}</b> ×${h.qty} @₹${h.avgPrice}`);
    await reply(`📊 <b>Portfolio (${rows.length})</b>\n${lines.join("\n") || "No holdings"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/watchlist") {
    const rows = await prisma.watchlist.findMany({ orderBy: { symbol: "asc" }, take: 20 });
    const lines = rows.map(w => `• <b>${w.symbol}</b> (${w.exchange})`);
    await reply(`👁️ <b>Watchlist</b>\n${lines.join("\n") || "Empty"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/journal") {
    const rows = await prisma.journal.findMany({ orderBy: { tradeDate: "desc" }, take: 7 });
    const lines = rows.map(r => `• ${r.direction === "BUY" ? "🟢" : "🔴"} <b>${r.symbol}</b> ×${r.qty} @₹${r.entryPrice}${r.pnl != null ? ` P&L ₹${r.pnl}` : ""}`);
    await reply(`📓 <b>Recent Journal</b>\n${lines.join("\n") || "No trades"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/note") {
    const row = await prisma.journalNote.findUnique({ where: { noteDate: new Date(istToday()) } });
    await reply(`📝 <b>Note ${istToday()}</b>\n${row?.content || "No note today"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/pnl") {
    const trades = await prisma.intradayTrade.findMany({ where: { tradeDate: new Date(istToday()) } });
    if (!trades.length) { await reply("No intraday trades today"); return NextResponse.json({ ok: true }); }
    const lots: Record<string, { qty: number; price: number }[]> = {}; const realised: Record<string, number> = {};
    for (const t of trades) {
      const k = t.symbol; lots[k] ??= []; realised[k] ??= 0;
      if (t.side === "BUY") lots[k].push({ qty: t.qty, price: t.price });
      else { let rem = t.qty; while (rem > 0 && lots[k].length) { const lot = lots[k][0]; const u = Math.min(rem, lot.qty); realised[k] += u * (t.price - lot.price); lot.qty -= u; rem -= u; if (lot.qty <= 0) lots[k].shift(); } }
    }
    const total = Object.values(realised).reduce((s, p) => s + p, 0);
    await reply(`💰 <b>Intraday P&L</b> ${istToday()}\n${total >= 0 ? "🟢" : "🔴"} Net: ₹${total.toFixed(2)}\nTrades: ${trades.length}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/ltp") {
    const sym = text.split(" ")[1]?.toUpperCase();
    if (!sym) { await reply("Usage: /ltp SYMBOL"); return NextResponse.json({ ok: true }); }
    const q = await getLtp(sym, "NSE");
    await reply(`📊 <b>${sym}</b>\n💵 LTP: ₹${q.ltp.toFixed(2)} (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)\n📡 ${q.source}`);
    return NextResponse.json({ ok: true });
  }
  if (["/brief", "/research", "/risk", "/ideas", "/week"].includes(cmd)) {
    await reply("🤖 Thinking...");
    try {
      let prompt = "", system = "You are an Indian equity market analyst. Be concise.";
      if (cmd === "/brief") prompt = "5-bullet pre-market brief for Indian markets: Nifty outlook, sectors, 2 stocks to watch, 1 risk. Max 150 words.";
      else if (cmd === "/research") { const s = text.split(" ")[1]?.toUpperCase() ?? "NIFTY"; prompt = `Research ${s}: business, performance, risks, outlook. Max 200 words.`; }
      else if (cmd === "/risk") { const rows = await prisma.portfolio.findMany({ select: { symbol: true, sector: true } }); prompt = `Risk analysis for: ${rows.map(h => `${h.symbol}(${h.sector})`).join(",")}. Score 0-100, verdict, top 3 risks. Max 150 words.`; }
      else if (cmd === "/ideas") prompt = "3 specific intraday trade ideas for NSE today: symbol, direction, entry, target, stop. Max 200 words.";
      else if (cmd === "/week") { const rows = await prisma.portfolio.findMany({ select: { symbol: true } }); prompt = `Weekly plan for ${rows.map(h => h.symbol).join(",")}: outlook, key levels, 3 stocks, risk mgmt. Max 220 words.`; }
      const r = await askAI(prompt, system, 400, "market_insight");
      await reply(`${cmd === "/brief" ? "🌅" : cmd === "/research" ? "🔬" : cmd === "/risk" ? "⚠️" : "💡"} <b>${cmd.slice(1).toUpperCase()}</b>\n${r.text}\n\n<i>via ${r.provider}</i>`);
    } catch { await reply("⚠️ AI unavailable. Try again later."); }
    return NextResponse.json({ ok: true });
  }

  const parsed = parseAlert(text);
  if (parsed) {
    await prisma.alert.create({ data: { symbol: parsed.symbol, exchange: parsed.exchange, condition: parsed.condition, price: parsed.price, alertType: "once", remarks: "via Telegram" } });
    await reply(`✅ <b>Alert Created!</b>\n📊 <b>${parsed.symbol}</b> · ${parsed.exchange}\n🎯 ${parsed.condition} ₹${parsed.price}`);
    return NextResponse.json({ ok: true });
  }
  await reply("❓ Unknown command. Send /help.\n\nCreate alert: <code>RELIANCE &gt; 2500</code>");
  return NextResponse.json({ ok: true });
}
