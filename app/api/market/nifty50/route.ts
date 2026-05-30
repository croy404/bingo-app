import { NextResponse } from "next/server";
import { SECTOR_MAP } from "@/lib/market-data";
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  try {
    const res = await fetch("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050", {
      headers: { "User-Agent":"Mozilla/5.0","Accept":"application/json","Referer":"https://www.nseindia.com/" },
      next: { revalidate: 60 },
    });
    const data = await res.json();
    const stocks = (data.data ?? []).map((s: Record<string, number | string>) => ({
      symbol: s.symbol, name: s.meta ?? s.symbol,
      sector: SECTOR_MAP[String(s.symbol)] ?? "Other",
      ltp: +(Number(s.lastPrice) || 0).toFixed(2),
      changePercent: +(Number(s.pChange) || 0).toFixed(2),
    }));
    return NextResponse.json(stocks);
  } catch { return NextResponse.json([]); }
}
