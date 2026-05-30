import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession as iciciSession } from "@/lib/broker-icici";
import { getSession as fyersSession } from "@/lib/broker-fyers";
import { istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const [at, aa, wl, pc, it, icici, fyers] = await Promise.all([
    prisma.alert.count(),
    prisma.alert.count({ where: { isActive: true } }),
    prisma.watchlist.count(),
    prisma.portfolio.count(),
    prisma.intradayTrade.count({ where: { tradeDate: new Date(istToday()) } }),
    iciciSession(),
    fyersSession(),
  ]);
  return NextResponse.json({
    totalAlerts: at, activeAlerts: aa, watchlistCount: wl, portfolioCount: pc, intradayTrades: it,
    broker: { icici: !!icici, fyers: !!fyers, active: icici ? "icici" : fyers ? "fyers" : "none" },
  });
}
