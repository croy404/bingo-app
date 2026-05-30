import { NextResponse } from "next/server";
import { getLtp } from "@/lib/ltp";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "";
  const exchange = searchParams.get("exchange") ?? "NSE";
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  const q = await getLtp(symbol, exchange);
  return NextResponse.json({
    symbol: q.symbol, exchange: q.exchange, ltp: +q.ltp.toFixed(2),
    prevClose: +q.prevClose.toFixed(2), change: +q.change.toFixed(2),
    changePercent: +q.changePercent.toFixed(2), source: q.source,
  });
}
