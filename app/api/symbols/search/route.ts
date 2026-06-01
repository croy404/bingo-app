import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/symbols";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const exchange = searchParams.get("exchange") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  if (!q || q.length < 1) return NextResponse.json([]);
  return NextResponse.json(await searchSymbols(q, exchange, limit));
}
