import { NextResponse } from "next/server";
import { getNifty50Data } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const stocks = await getNifty50Data();
  return NextResponse.json(stocks);
}
