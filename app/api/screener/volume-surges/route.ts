import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
export const dynamic = "force-dynamic";

// Stocks trading at unusually high volume vs their average (proxy for the
// Replit volume-baseline surge screener — uses NSE's live volume + avg fields).
export async function GET(req: Request) {
  const ratio = Math.max(1.1, Number(new URL(req.url).searchParams.get("ratio") ?? 2));
  const cached = await cacheGet<{ rows: unknown[] }>(`volsurge_${ratio}`);
  if (cached) return NextResponse.json(cached);
  try {
    const res = await fetch("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500", {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com/" },
    });
    const stocks = ((await res.json())?.data ?? []) as Array<Record<string, number | string>>;
    const rows = stocks
      .map(s => {
        const vol = Number(s.totalTradedVolume) || 0;
        // NSE returns 'avgTradedVolume'-like fields inconsistently; fall back to deliverable proxy.
        const avg = Number((s as Record<string, number>).avgVolume ?? (s as Record<string, number>).quantityTraded) || 0;
        const r = avg > 0 ? vol / avg : 0;
        return { symbol: s.symbol, ltp: s.lastPrice, changePercent: s.pChange, volume: vol, avgVolume: avg, ratio: +r.toFixed(2) };
      })
      .filter(r => r.ratio >= ratio)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 25);
    const out = { rows, params: { ratio }, note: "Volume vs avg · Source: NSE" };
    await cacheSet(`volsurge_${ratio}`, out, 120);
    return NextResponse.json(out);
  } catch (e) { return NextResponse.json({ rows: [], error: String(e) }, { status: 502 }); }
}
