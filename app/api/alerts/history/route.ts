import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.alertHistory.findMany({ orderBy: { triggeredAt: "desc" }, take: 100 });
  // map to camel→snake the UI expects
  return NextResponse.json(rows.map(r => ({
    id: r.id, symbol: r.symbol, exchange: r.exchange, condition: r.condition,
    target_price: r.targetPrice, triggered_ltp: r.triggeredLtp, triggered_at: r.triggeredAt,
  })));
}
export async function DELETE() {
  await prisma.alertHistory.deleteMany({});
  return NextResponse.json({ message: "Cleared" });
}
