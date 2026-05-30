import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai-provider";
import { istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";

async function send(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function getConfig() {
  const { data } = await supabase.from("settings").select("key,value");
  return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
}

const COND_MAP: Record<string, string> = {">":">","<":"<",">=":">=","<=":"<=","=>":">=","=<":"<=","=":">="};

function parseAlert(text: string) {
  const tokens = text.trim().toUpperCase().split(/\s+/);
  let ci = -1, cond = "";
  for (let i = 0; i < tokens.length; i++) {
    if (COND_MAP[tokens[i]]) { ci = i; cond = COND_MAP[tokens[i]]; break; }
  }
  if (ci <= 0 || ci >= tokens.length - 1) return null;
  const price = parseFloat(tokens[ci+1].replace(/,/g,""));
  if (!price || price <= 0) return null;
  const before = tokens.slice(0, ci);
  let exchange = "NSE";
  const exchanges = new Set(["NSE","BSE","NFO","MCX"]);
  if (before.length > 1 && exchanges.has(before[before.length-1])) {
    exchange = before.pop()!;
  }
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
    await reply("🤖 <b>BINGO Bot</b>\n/status /alerts /history /portfolio /watchlist /journal /pnl /note\n/ltp SYMBOL /delete SYMBOL /clear /snooze SYMBOL N /bracket SYMBOL EXCH ABOVE BELOW\n/brief /research SYMBOL /risk /ideas /week\n\n📌 Create alert: <code>RELIANCE &gt; 2500</code>");
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/status") {
    const { count: ac } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("is_active", true);
    const { count: pc } = await supabase.from("portfolio").select("*", { count: "exact", head: true });
    await reply(`📡 <b>BINGO Status</b>\n🔔 Active Alerts: <b>${ac??0}</b>\n📊 Portfolio: <b>${pc??0}</b> holdings`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/alerts") {
    const { data } = await supabase.from("alerts").select("*").eq("is_active", true).limit(20);
    const lines = (data??[]).map(a => `• <b>${a.symbol}</b> ${a.condition} ₹${a.price}`);
    await reply(`🔔 <b>Active Alerts (${lines.length})</b>\n${lines.join("\n") || "None"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/history") {
    const { data } = await supabase.from("alert_history").select("*").order("triggered_at", { ascending: false }).limit(10);
    const lines = (data??[]).map(h => `• <b>${h.symbol}</b> ${h.condition} ₹${h.target_price} → ₹${h.triggered_ltp}`);
    await reply(`📋 <b>Alert History</b>\n${lines.join("\n") || "None"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/clear") {
    const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("is_active", true);
    await supabase.from("alerts").update({ is_active: false }).eq("is_active", true);
    await reply(`🗑️ Cleared <b>${count??0}</b> alerts`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/portfolio") {
    const { data } = await supabase.from("portfolio").select("symbol,qty,avg_price");
    const lines = (data??[]).slice(0,12).map(h => `• <b>${h.symbol}</b> ×${h.qty} @₹${h.avg_price}`);
    await reply(`📊 <b>Portfolio (${data?.length??0})</b>\n${lines.join("\n") || "No holdings"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/watchlist") {
    const { data } = await supabase.from("watchlist").select("symbol,exchange").order("symbol");
    const lines = (data??[]).map(w => `• <b>${w.symbol}</b> (${w.exchange})`);
    await reply(`👁️ <b>Watchlist</b>\n${lines.join("\n") || "Empty"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/note") {
    const today = istToday();
    const { data } = await supabase.from("journal_notes").select("content").eq("note_date", today).single();
    await reply(`📝 <b>Note ${today}</b>\n${data?.content || "No note yet"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/pnl") {
    const today = istToday();
    const { data: trades } = await supabase.from("intraday_trades").select("*").eq("trade_date", today);
    if (!trades?.length) { await reply("No intraday trades today"); return NextResponse.json({ ok: true }); }
    await reply(`💰 <b>Intraday</b> ${today}\n${trades.length} trades logged`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/ltp") {
    const sym = text.split(" ")[1]?.toUpperCase();
    if (!sym) { await reply("Usage: /ltp SYMBOL"); return NextResponse.json({ ok: true }); }
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=1d`, { headers: { "User-Agent":"Mozilla/5.0" } });
    const meta = (await res.json())?.chart?.result?.[0]?.meta ?? {};
    await reply(`📊 <b>${sym}</b>\n💵 LTP: ₹${meta.regularMarketPrice?.toFixed(2) ?? "N/A"}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/delete") {
    const sym = text.split(" ").slice(1).join(" ").toUpperCase();
    if (!sym) { await reply("Usage: /delete SYMBOL"); return NextResponse.json({ ok: true }); }
    const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("symbol", sym).eq("is_active", true);
    await supabase.from("alerts").update({ is_active: false }).eq("symbol", sym).eq("is_active", true);
    await reply(`🗑️ Deactivated <b>${count??0}</b> alert(s) for ${sym}`);
    return NextResponse.json({ ok: true });
  }
  if (cmd === "/bracket") {
    const parts = text.split(" ").slice(1);
    const [sym, exch, aboveStr, belowStr] = parts;
    if (!sym || !exch || !aboveStr || !belowStr) { await reply("Usage: /bracket SYMBOL EXCH ABOVE BELOW"); return NextResponse.json({ ok: true }); }
    const above = parseFloat(aboveStr), below = parseFloat(belowStr);
    await supabase.from("alerts").insert([
      { symbol: sym.toUpperCase(), exchange: exch.toUpperCase(), condition: ">", price: above, alert_type: "once", remarks: "target" },
      { symbol: sym.toUpperCase(), exchange: exch.toUpperCase(), condition: "<", price: below, alert_type: "once", remarks: "stop-loss" },
    ]);
    await reply(`✅ Bracket: ${sym} > ₹${above} (target) | < ₹${below} (stop-loss)`);
    return NextResponse.json({ ok: true });
  }
  // AI commands
  if (["/brief","/research","/risk","/ideas","/week"].includes(cmd)) {
    await reply("🤖 Thinking...");
    try {
      let prompt = "", system = "You are an Indian equity market analyst. Be concise.";
      if (cmd === "/brief") prompt = "5-bullet pre-market brief for Indian markets: Nifty outlook, sectors, 2 stocks to watch, 1 risk. Max 150 words.";
      else if (cmd === "/research") { const s = text.split(" ")[1]?.toUpperCase() ?? "NIFTY"; prompt = `Research ${s}: business, performance, risks, outlook. Max 200 words.`; }
      else if (cmd === "/risk") { const { data } = await supabase.from("portfolio").select("symbol,qty,avg_price,sector"); prompt = `Risk analysis for: ${(data??[]).map(h=>`${h.symbol}(${h.sector})`).join(",")}. Score 0-100, verdict, top 3 risks. Max 150 words.`; }
      else if (cmd === "/ideas") prompt = "3 specific intraday trade ideas for NSE today: symbol, direction, entry, target, stop. Max 200 words.";
      else if (cmd === "/week") { const { data } = await supabase.from("portfolio").select("symbol"); prompt = `Weekly plan for ${(data??[]).map(h=>h.symbol).join(",")}: market outlook, key levels, 3 stocks, risk management. Max 220 words.`; }
      const result = await askAI(prompt, system, 400, "market_insight");
      await reply(`${cmd === "/brief" ? "🌅" : cmd === "/research" ? "🔬" : cmd === "/risk" ? "⚠️" : "💡"} <b>${cmd.slice(1).toUpperCase()}</b>\n${result.text}\n\n<i>via ${result.provider}</i>`);
    } catch { await reply("⚠️ AI unavailable. Try again later."); }
    return NextResponse.json({ ok: true });
  }
  // Alert creation
  const parsed = parseAlert(text);
  if (parsed) {
    await supabase.from("alerts").insert({ symbol: parsed.symbol, exchange: parsed.exchange, condition: parsed.condition, price: parsed.price, alert_type: "once", remarks: "via Telegram" });
    await reply(`✅ <b>Alert Created!</b>\n📊 <b>${parsed.symbol}</b> · ${parsed.exchange}\n🎯 ${parsed.condition} ₹${parsed.price}`);
    return NextResponse.json({ ok: true });
  }
  await reply("❓ Unknown command. Send /help for all commands.\n\nTo create alert: <code>RELIANCE &gt; 2500</code>");
  return NextResponse.json({ ok: true });
}
