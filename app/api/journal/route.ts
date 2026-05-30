import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.journal.findMany({ orderBy: { tradeDate: "desc" } });
  return NextResponse.json(rows.map(r => ({
    id: r.id, trade_date: r.tradeDate.toISOString().slice(0, 10), symbol: r.symbol,
    direction: r.direction, qty: r.qty, entry_price: r.entryPrice, exit_price: r.exitPrice,
    pnl: r.pnl, setup: r.setup, emotion: r.emotion, notes: r.notes,
  })));
}
export async function POST(req: Request) {
  const b = await req.json();
  let pnl = b.pnl;
  if (pnl == null && b.exit_price) {
    const mult = b.direction === "BUY" ? 1 : -1;
    pnl = mult * (Number(b.exit_price) - Number(b.entry_price)) * Number(b.qty);
  }
  const row = await prisma.journal.create({
    data: {
      tradeDate: new Date(b.trade_date), symbol: (b.symbol ?? "").toUpperCase(),
      direction: b.direction, qty: Number(b.qty), entryPrice: Number(b.entry_price),
      exitPrice: b.exit_price ? Number(b.exit_price) : null, pnl: pnl ?? null,
      setup: b.setup ?? "", emotion: b.emotion ?? "", notes: b.notes ?? "",
    },
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.journal.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "Deleted" });
}
