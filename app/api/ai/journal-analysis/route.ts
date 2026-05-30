import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function POST() {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const { data } = await supabase.from("journal").select("trade_date,symbol,direction,pnl,emotion,notes").order("trade_date", { ascending: false }).limit(30);
  if (!data?.length) return NextResponse.json({ error: "No journal entries" }, { status: 400 });
  const block = data.map(e => `${e.trade_date} | ${e.symbol} | ${e.direction} | P&L ${e.pnl ?? "n/a"}${e.emotion ? ` | ${e.emotion}` : ""}`).join("\n");
  try {
    const r = await askAI(
      `Trade journal:\n${block}\n\nIdentify: recurring mistakes/biases, positive patterns, 1 specific improvement action. Max 200 words, bullets.`,
      "You are a trading psychology coach. Be direct.", 500, "portfolio_analysis");
    return NextResponse.json({ analysis: r.text, provider: r.provider });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
