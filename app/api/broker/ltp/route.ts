import { NextResponse } from "next/server";
import { getLtp } from "@/lib/ltp";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "";
  const exchange = searchParams.get("exchange") ?? "NSE";
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  return NextResponse.json(await getLtp(symbol, exchange));
}
