import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getNifty50Data } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ratio = Math.max(1.1, Number(new URL(req.url).searchParams.get("ratio") ?? 2));
  const cached = await cacheGet<{ rows: unknown[] }>(`volsurge_${ratio}`);
  if (cached) return NextResponse.json(cached);

  // Try NSE Nifty 500 first
  try {
    const res = await fetch("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500", {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com/" },
    });
    const text = await res.text();
    if (text.trimStart().startsWith("<")) throw new Error("NSE blocked");
    const stocks = (JSON.parse(text)?.data ?? []) as Array<Record<string, number | string>>;
    const rows = stocks
      .map((s) => {
        const vol = Number(s.totalTradedVolume) || 0;
        const avg = Number((s as Record<string, number>).avgVolume ?? (s as Record<string, number>).quantityTraded) || 0;
        const r = avg > 0 ? vol / avg : 0;
        return { symbol: s.symbol, ltp: s.lastPrice, changePercent: s.pChange, volume: vol, avgVolume: avg, ratio: +r.toFixed(2) };
      })
      .filter((r) => r.ratio >= ratio)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 25);
    const out = { rows, params: { ratio }, note: "Volume vs avg · Source: NSE" };
    await cacheSet(`volsurge_${ratio}`, out, 120);
    return NextResponse.json(out);
  } catch {
    // Fallback: use Nifty 50 Yahoo data with 10-day avg volume
    const stocks = await getNifty50Data();
    const rows = stocks
      .filter((s) => s.volume > 0)
      .map((s) => {
        const r = s.avgVolume10d > 0 ? +(s.volume / s.avgVolume10d).toFixed(2) : 0;
        return { symbol: s.symbol, ltp: s.ltp, changePercent: s.changePercent, volume: s.volume, avgVolume: s.avgVolume10d, ratio: r };
      })
      .filter((r) => r.ratio >= ratio || r.ratio === 0) // include all when ratio unknown
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 25);
    const out = { rows, params: { ratio }, note: "Nifty 50 · Source: Yahoo Finance (15 min delay)" };
    await cacheSet(`volsurge_${ratio}`, out, 180);
    return NextResponse.json(out);
  }
}
