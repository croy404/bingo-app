import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cacheGet } from "@/lib/redis";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.watchlist.findMany({ orderBy: { symbol: "asc" } });
  const enriched = await Promise.all(
    items.map(async (item) => {
      const cached = await cacheGet<{ ltp: number; changePercent: number; change: number; prevClose: number; source: string }>(
        `price:${item.exchange}:${item.symbol}`
      );
      return {
        ...item,
        ltp: cached?.ltp ?? null,
        changePercent: cached?.changePercent ?? null,
        change: cached?.change ?? null,
        prevClose: cached?.prevClose ?? null,
        source: cached?.source ?? null,
      };
    })
  );
  return NextResponse.json(enriched);
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
