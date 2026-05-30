import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached (60/hr)" }, { status: 429 });
  const { symbols } = await req.json();
  const lines = (symbols ?? []).slice(0,10).map((s: { symbol: string; exchange: string }) => `${s.symbol} (${s.exchange})`).join("\n");
  try {
    const r = await askAI(`Brief technical and sentiment insight for:\n${lines}`, "You are an Indian equity analyst. Max 200 words. No disclaimers.", 400, "market_insight");
    return NextResponse.json({ insight: r.text, provider: r.provider });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
