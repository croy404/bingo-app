import { NextResponse } from "next/server";
import { getNifty50Data } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type") ?? "gainers";
  const stocks = await getNifty50Data();
  if (!stocks.length) return NextResponse.json([]);
  const sorted = [...stocks].sort((a, b) =>
    type === "gainers" ? b.changePercent - a.changePercent : a.changePercent - b.changePercent
  );
  return NextResponse.json(sorted.slice(0, 20));
}
