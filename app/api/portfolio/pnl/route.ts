import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { xirrNewton, istToday } from "@/lib/market-data";
import { getLtp } from "@/lib/ltp";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.portfolio.findMany({ orderBy: { symbol: "asc" } });
  let ti = 0, tc = 0;
  const holdings = await Promise.all(rows.map(async (row) => {
    const q = await getLtp(row.symbol, row.exchange);
    const ltp = q.ltp || row.avgPrice;
    const inv = row.qty * row.avgPrice, cur = row.qty * ltp;
    const pnl = cur - inv, pct = inv ? (pnl / inv) * 100 : 0;
    ti += inv; tc += cur;
    let xirr: number | null = null;
    if (row.buyDate) {
      try { xirr = xirrNewton([{ amount: -inv, date: row.buyDate }, { amount: cur, date: new Date() }]); } catch { /* skip */ }
    }
    return {
      id: row.id, symbol: row.symbol, exchange: row.exchange, sector: row.sector,
      qty: row.qty, avg_price: row.avgPrice, ltp: +ltp.toFixed(2),
      invested: +inv.toFixed(2), current: +cur.toFixed(2),
      pnl: +pnl.toFixed(2), pnlPercent: +pct.toFixed(2),
      xirr: xirr ? +(xirr * 100).toFixed(2) : null, source: q.source,
    };
  }));
  const op = tc - ti;
  await prisma.portfolioSnapshot.upsert({
    where: { snapshotDate: new Date(istToday()) },
    create: { snapshotDate: new Date(istToday()), totalValue: +tc.toFixed(2), investedValue: +ti.toFixed(2), pnl: +op.toFixed(2), pnlPercent: ti ? +(op / ti * 100).toFixed(2) : 0 },
    update: { totalValue: +tc.toFixed(2), investedValue: +ti.toFixed(2), pnl: +op.toFixed(2), pnlPercent: ti ? +(op / ti * 100).toFixed(2) : 0 },
  });
  return NextResponse.json({
    holdings,
    summary: { totalInvested: +ti.toFixed(2), totalCurrent: +tc.toFixed(2), totalPnl: +op.toFixed(2), totalPnlPercent: ti ? +(op / ti * 100).toFixed(2) : 0 },
  });
}
