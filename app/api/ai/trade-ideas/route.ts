import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const { topGainers = [], topLosers = [] } = await req.json().catch(() => ({}));
  const g = topGainers.map((x: { symbol: string; changePct: number }) => `${x.symbol} +${x.changePct}%`).join(", ");
  const l = topLosers.map((x: { symbol: string; changePct: number }) => `${x.symbol} ${x.changePct}%`).join(", ");
  try {
    const r = await askAI(
      `Top gainers: ${g}\nTop losers: ${l}\n\nGive 3 trade ideas as JSON array: [{symbol,direction,reasoning,entryZone,riskReward}]`,
      "You are an Indian equity trader. Return ONLY a JSON array.", 500, "market_insight");
    const t = r.text; const s = t.indexOf("["); const e = t.lastIndexOf("]") + 1;
    const ideas = s >= 0 ? JSON.parse(t.slice(s, e)) : [];
    return NextResponse.json({ ideas, provider: r.provider });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
