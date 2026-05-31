import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.sipEntry.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows.map(r => ({
    id: r.id, name: r.name, symbol: r.symbol, exchange: r.exchange,
    isin: r.isin, frequency: r.frequency, amount: r.amount,
    start_date: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
  })));
}
export async function POST(req: Request) {
  const b = await req.json();
  const row = await prisma.sipEntry.create({
    data: {
      name: b.name, symbol: (b.symbol ?? "").toUpperCase(), exchange: b.exchange ?? "NSE",
      isin: b.isin ?? "", frequency: b.frequency ?? "monthly", amount: Number(b.amount),
      startDate: b.start_date ? new Date(b.start_date) : null,
    },
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.sipTransaction.deleteMany({ where: { sipId: Number(id) } });
  await prisma.sipEntry.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "Deleted" });
}
