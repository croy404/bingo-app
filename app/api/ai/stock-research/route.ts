import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
import { getLtp } from "@/lib/ltp";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const exchange = searchParams.get("exchange") ?? "NSE";
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  const q = await getLtp(symbol, exchange);
  const ctx = `${symbol} (${exchange}) LTP ₹${q.ltp.toFixed(2)}, change ${q.changePercent.toFixed(2)}%`;
  try {
    const r = await askAI(
      `Research note for: ${ctx}\n\nStructure: **Business Overview**, **Price Action**, **Key Risks**, **Outlook**. Quote ₹. Max 280 words.`,
      "You are a sell-side Indian equity analyst. No buy/sell calls.", 500, "research_report");
    return NextResponse.json({ research: r.text, provider: r.provider, symbol, ltp: q.ltp,
      disclaimer: "AI-generated. Not SEBI-registered advice. Do your own research." });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
