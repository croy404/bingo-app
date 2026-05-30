import { NextResponse } from "next/server";
import { SECTOR_MAP } from "@/lib/market-data";
export const dynamic = "force-dynamic";
export const revalidate = 300;
export async function GET() {
  try {
    const res = await fetch("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500", {
      headers: { "User-Agent":"Mozilla/5.0","Referer":"https://www.nseindia.com/" },
      next: { revalidate: 300 },
    });
    const stocks = (await res.json()).data ?? [];
    const sd: Record<string, { changes: number[]; advances: number; declines: number }> = {};
    for (const s of stocks) {
      const sec = SECTOR_MAP[s.symbol] ?? "Other";
      if (sec === "Other") continue;
      sd[sec] ??= { changes: [], advances: 0, declines: 0 };
      sd[sec].changes.push(s.pChange ?? 0);
      if (s.pChange > 0) sd[sec].advances++; else if (s.pChange < 0) sd[sec].declines++;
    }
    const result = Object.entries(sd)
      .filter(([, d]) => d.changes.length >= 2)
      .map(([sector, d]) => ({
        sector, avgChangePct: +(d.changes.reduce((a,b)=>a+b,0)/d.changes.length).toFixed(2),
        advancers: d.advances, decliners: d.declines, total: d.changes.length,
      }))
      .sort((a,b) => b.avgChangePct - a.avgChangePct);
    return NextResponse.json(result);
  } catch { return NextResponse.json([]); }
}
