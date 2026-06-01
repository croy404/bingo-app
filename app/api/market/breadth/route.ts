import { NextResponse } from "next/server";
import { getNifty50Data } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const stocks = await getNifty50Data();
  if (!stocks.length) return NextResponse.json({ advances: 0, declines: 0, unchanged: 0, total: 0 });
  const adv = stocks.filter((s) => s.changePercent > 0.05).length;
  const dec = stocks.filter((s) => s.changePercent < -0.05).length;
  return NextResponse.json({
    advances: adv, declines: dec,
    unchanged: stocks.length - adv - dec, total: stocks.length,
  });
}
