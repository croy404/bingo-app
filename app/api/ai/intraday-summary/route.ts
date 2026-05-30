import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
import { supabase } from "@/lib/supabase";
import { istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const today = istToday();
  const { data: trades } = await supabase.from("intraday_trades").select("*").eq("trade_date", today);
  if (!trades?.length) return NextResponse.json({ summary: "No intraday trades logged today.", provider: "none", trades: 0 });
  // FIFO realised
  const lots: Record<string, { qty: number; price: number }[]> = {};
  const realised: Record<string, number> = {};
  let turnover = 0;
  for (const t of trades) {
    const k = t.symbol; turnover += t.qty * t.price;
    lots[k] ??= []; realised[k] ??= 0;
    if (t.side === "BUY") lots[k].push({ qty: t.qty, price: t.price });
    else { let rem = t.qty; while (rem > 0 && lots[k].length) { const lot = lots[k][0]; const used = Math.min(rem, lot.qty); realised[k] += used * (t.price - lot.price); lot.qty -= used; rem -= used; if (lot.qty <= 0) lots[k].shift(); } }
  }
  const total = Object.values(realised).reduce((s, p) => s + p, 0);
  const wins = Object.values(realised).filter(p => p > 0).length;
  const losers = Object.values(realised).filter(p => p < 0).length;
  try {
    const r = await askAI(
      `Intraday ${today}: ${trades.length} trades, turnover ₹${turnover.toFixed(0)}, realised P&L ₹${total.toFixed(0)} (W:${wins} L:${losers}).\n\n4 bullets (<=20 words): session commentary, what worked, fix for tomorrow, discipline grade A-F.`,
      "You are a disciplined Indian intraday trading coach.", 400, "market_insight");
    return NextResponse.json({ summary: r.text, provider: r.provider, trades: trades.length, realisedPnl: total, winners: wins, losers });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
