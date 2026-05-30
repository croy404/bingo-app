import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const index = searchParams.get("index") ?? "NIFTY%2050";
  const type = searchParams.get("type") ?? "gainers";
  try {
    const res = await fetch(`https://www.nseindia.com/api/equity-stockIndices?index=${index}`, {
      headers: { "User-Agent":"Mozilla/5.0","Referer":"https://www.nseindia.com/" },
      next: { revalidate: 60 },
    });
    const stocks = ((await res.json()).data ?? [])
      .filter((s: { symbol: string }) => !["NIFTY 50","NIFTY BANK","NIFTY NEXT 50"].includes(s.symbol))
      .sort((a: { pChange: number }, b: { pChange: number }) => type === "gainers" ? b.pChange - a.pChange : a.pChange - b.pChange)
      .slice(0, 20)
      .map((s: { symbol: string; lastPrice: number; change: number; pChange: number; totalTradedVolume: number; dayHigh: number; dayLow: number }) => ({
        symbol: s.symbol, ltp: s.lastPrice, change: s.change,
        changePercent: s.pChange, volume: s.totalTradedVolume,
        high: s.dayHigh, low: s.dayLow,
      }));
    return NextResponse.json(stocks);
  } catch { return NextResponse.json([]); }
}
