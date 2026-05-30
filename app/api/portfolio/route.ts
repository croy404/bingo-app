import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SECTOR_MAP } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.portfolio.findMany({ orderBy: { symbol: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  const sym = (b.symbol ?? "").toUpperCase();
  const row = await prisma.portfolio.create({
    data: {
      symbol: sym, exchange: b.exchange ?? "NSE", companyName: b.company_name ?? "",
      qty: Number(b.qty), avgPrice: Number(b.avg_price),
      buyDate: b.buy_date ? new Date(b.buy_date) : null,
      sector: SECTOR_MAP[sym] ?? "Other", notes: b.notes ?? "",
    },
  });
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.portfolio.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "Deleted" });
}
