import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? istToday();
  const rows = await prisma.intradayTrade.findMany({ where: { tradeDate: new Date(date) }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ date, trades: rows.map(r => ({
    id: r.id, symbol: r.symbol, exchange: r.exchange, side: r.side, qty: r.qty, price: r.price, notes: r.notes,
  })) });
}
export async function POST(req: Request) {
  const b = await req.json();
  const row = await prisma.intradayTrade.create({
    data: {
      tradeDate: new Date(b.trade_date || istToday()), symbol: (b.symbol ?? "").toUpperCase(),
      exchange: b.exchange ?? "NSE", side: (b.side ?? "BUY").toUpperCase(),
      qty: Number(b.qty), price: Number(b.price), notes: b.notes ?? "",
    },
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.intradayTrade.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "Deleted" });
}
