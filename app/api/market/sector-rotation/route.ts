import { NextResponse } from "next/server";
import { getNifty50Data } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const stocks = await getNifty50Data();
  if (!stocks.length) return NextResponse.json([]);
  const sd: Record<string, { changes: number[]; advances: number; declines: number }> = {};
  for (const s of stocks) {
    if (s.sector === "Other") continue;
    sd[s.sector] ??= { changes: [], advances: 0, declines: 0 };
    sd[s.sector].changes.push(s.changePercent);
    if (s.changePercent > 0) sd[s.sector].advances++;
    else if (s.changePercent < 0) sd[s.sector].declines++;
  }
  const result = Object.entries(sd)
    .map(([sector, d]) => ({
      sector,
      avgChangePct: +(d.changes.reduce((a, b) => a + b, 0) / d.changes.length).toFixed(2),
      advancers: d.advances, decliners: d.declines, total: d.changes.length,
    }))
    .sort((a, b) => b.avgChangePct - a.avgChangePct);
  return NextResponse.json(result);
}
