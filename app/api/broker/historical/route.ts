import { NextResponse } from "next/server";
import { breezeHistorical, getSession as iciciSession } from "@/lib/broker-icici";
import { fyersHistorical, toFyersSymbol, getSession as fyersSession } from "@/lib/broker-fyers";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "";
  const exchange = searchParams.get("exchange") ?? "NSE";
  const interval = searchParams.get("interval") ?? "1day";
  const days = Math.min(Number(searchParams.get("days") ?? 30), 365);
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const to = new Date(), from = new Date(Date.now() - days * 86400000);

  if (await iciciSession()) {
    const candles = await breezeHistorical(symbol, exchange, interval as "1day", from, to);
    if (candles.length) return NextResponse.json({ symbol, exchange, interval, candles, source: "icici" });
  }
  if (await fyersSession()) {
    const resMap: Record<string, string> = { "1minute": "1", "5minute": "5", "30minute": "30", "1day": "D" };
    const candles = await fyersHistorical(toFyersSymbol(exchange, symbol), resMap[interval] ?? "D", from, to);
    if (candles?.length) return NextResponse.json({ symbol, exchange, interval, candles, source: "fyers" });
  }
  return NextResponse.json({ symbol, exchange, candles: [], source: "none", note: "Connect a broker for historical data" });
}
