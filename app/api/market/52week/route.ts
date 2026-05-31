import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
export const dynamic = "force-dynamic";

// Nifty 50 stocks nearest their 52-week high / low.
export async function GET() {
  const cached = await cacheGet<{ nearHigh: unknown[]; nearLow: unknown[] }>("week52");
  if (cached) return NextResponse.json(cached);
  try {
    const res = await fetch("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050", {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com/" },
    });
    const stocks = ((await res.json())?.data ?? []) as Array<Record<string, number | string>>;
    const fmt = (s: Record<string, number | string>) => ({
      symbol: s.symbol, ltp: s.lastPrice, high52w: s.yearHigh, low52w: s.yearLow, pChange: s.pChange,
    });
    const nearHigh = stocks.filter(s => Number(s.yearHigh) > 0)
      .sort((a, b) => Number(b.lastPrice) / Number(b.yearHigh) - Number(a.lastPrice) / Number(a.yearHigh))
      .slice(0, 15).map(fmt);
    const nearLow = stocks.filter(s => Number(s.yearLow) > 0)
      .sort((a, b) => Number(a.lastPrice) / Number(a.yearLow) - Number(b.lastPrice) / Number(b.yearLow))
      .slice(0, 15).map(fmt);
    const out = { nearHigh, nearLow };
    await cacheSet("week52", out, 1800);
    return NextResponse.json(out);
  } catch (e) { return NextResponse.json({ error: String(e), nearHigh: [], nearLow: [] }, { status: 502 }); }
}
