import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? istToday();
  const trades = await prisma.intradayTrade.findMany({
    where: { tradeDate: new Date(date) },
    orderBy: { createdAt: "asc" },
  });

  // FIFO P&L per symbol
  const lots: Record<string, { qty: number; price: number }[]> = {};
  const realized: Record<string, number> = {};
  const openQty: Record<string, number> = {};

  for (const t of trades) {
    const k = t.symbol;
    lots[k] ??= [];
    realized[k] ??= 0;
    openQty[k] ??= 0;
    if (t.side === "BUY") {
      lots[k].push({ qty: t.qty, price: t.price });
      openQty[k] += t.qty;
    } else {
      let rem = t.qty;
      openQty[k] -= t.qty;
      while (rem > 0 && lots[k].length) {
        const lot = lots[k][0];
        const u = Math.min(rem, lot.qty);
        realized[k] += u * (t.price - lot.price);
        lot.qty -= u;
        rem -= u;
        if (lot.qty <= 0) lots[k].shift();
      }
    }
  }

  const perSymbol = Object.keys(realized).map((symbol) => ({
    symbol,
    realized_pnl: +realized[symbol].toFixed(2),
    status: (openQty[symbol] ?? 0) > 0 ? "Open" : (openQty[symbol] ?? 0) < 0 ? "Short" : "Closed",
  }));

  const totalPnl = +Object.values(realized).reduce((s, p) => s + p, 0).toFixed(2);
  const closed = perSymbol.filter((s) => s.status === "Closed");
  const wins = closed.filter((s) => s.realized_pnl > 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  return NextResponse.json({ date, totalPnl, totalTrades: trades.length, winRate, perSymbol });
}
