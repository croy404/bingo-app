import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  try {
    const r = await askAI(
      "Give a 5-6 bullet Indian market overview: sentiment, sector themes, momentum, key risks, 1 actionable insight. Each bullet under 20 words.",
      "You are a concise Indian stock market strategist.", 400, "market_insight");
    return NextResponse.json({ summary: r.text, provider: r.provider });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
