import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const rows = await prisma.portfolioSnapshot.findMany({ orderBy: { snapshotDate: "asc" } });
  return NextResponse.json(rows.map(r => ({
    snapshot_date: r.snapshotDate.toISOString().slice(0, 10),
    total_value: r.totalValue, invested_value: r.investedValue, pnl: r.pnl, pnl_percent: r.pnlPercent,
  })));
}
