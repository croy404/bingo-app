import { NextResponse } from "next/server";
import { getLtp } from "@/lib/ltp";
export const dynamic = "force-dynamic";

// Quick "would this alert have fired?" check against the latest available price.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const symbol = (sp.get("symbol") ?? "").toUpperCase();
  const exchange = (sp.get("exchange") ?? "NSE").toUpperCase();
  const condition = sp.get("condition") ?? ">";
  const price = parseFloat(sp.get("price") ?? "0");
  if (!symbol || !price || price <= 0) return NextResponse.json({ note: "Enter symbol and price to backtest" });

  const q = await getLtp(symbol, exchange, { force: true });
  const last = q.ltp;
  if (!last) return NextResponse.json({ symbol, exchange, note: "No recent price available" });

  let fired = false;
  if (condition === ">") fired = last > price;
  else if (condition === ">=") fired = last >= price;
  else if (condition === "<") fired = last < price;
  else if (condition === "<=") fired = last <= price;

  const pctFrom = q.prevClose > 0 ? +(((price - q.prevClose) / q.prevClose) * 100).toFixed(2) : 0;
  return NextResponse.json({
    symbol, exchange, condition, targetPrice: price,
    lastPrice: last, prevClose: q.prevClose, source: q.source,
    wouldHaveTriggered: fired, pctFromPrevClose: pctFrom,
    note: fired
      ? `Would trigger now — ₹${last.toFixed(2)} ${condition} ₹${price.toFixed(2)}`
      : `Would NOT trigger — last ₹${last.toFixed(2)} vs target ${condition} ₹${price.toFixed(2)} (${pctFrom >= 0 ? "+" : ""}${pctFrom}% from prev close)`,
  });
}
