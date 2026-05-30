import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await prisma.watchlist.findMany({ orderBy: { symbol: "asc" } }));
}
export async function POST(req: Request) {
  const { symbol, exchange = "NSE" } = await req.json();
  await prisma.watchlist.upsert({
    where: { symbol_exchange: { symbol: symbol.toUpperCase(), exchange } },
    create: { symbol: symbol.toUpperCase(), exchange },
    update: {},
  });
  return NextResponse.json({ message: "Added" });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.watchlist.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "Deleted" });
}
