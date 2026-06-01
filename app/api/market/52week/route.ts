import { NextResponse } from "next/server";
import { getNifty50Data } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const stocks = await getNifty50Data();
  if (!stocks.length) return NextResponse.json({ nearHigh: [], nearLow: [] });
  const fmt = (s: typeof stocks[0]) => ({
    symbol: s.symbol, ltp: s.ltp, high52w: s.high52w, low52w: s.low52w, pChange: s.changePercent,
  });
  const nearHigh = [...stocks]
    .filter((s) => s.high52w > 0)
    .sort((a, b) => b.ltp / b.high52w - a.ltp / a.high52w)
    .slice(0, 15).map(fmt);
  const nearLow = [...stocks]
    .filter((s) => s.low52w > 0)
    .sort((a, b) => a.ltp / a.low52w - b.ltp / b.low52w)
    .slice(0, 15).map(fmt);
  return NextResponse.json({ nearHigh, nearLow });
}
