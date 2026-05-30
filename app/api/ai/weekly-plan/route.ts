import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function POST() {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const { data: holdings } = await supabase.from("portfolio").select("symbol,sector");
  if (!holdings?.length) return NextResponse.json({ error: "No holdings" }, { status: 400 });
  const list = holdings.map(h => `${h.symbol}${h.sector ? ` [${h.sector}]` : ""}`).join(", ");
  try {
    const r = await askAI(
      `Holdings: ${list}\n\nProduce a weekly trading plan (next 5 NSE sessions): MARKET OUTLOOK, KEY LEVELS, WATCHLIST FOCUS (3 names), RISK MANAGEMENT, BIAS. Max 220 words.`,
      "You are a disciplined Indian equity portfolio strategist.", 600, "portfolio_analysis");
    return NextResponse.json({ plan: r.text, provider: r.provider });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
