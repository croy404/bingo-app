import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SECTOR_MAP } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase.from("portfolio").select("*").order("symbol");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase.from("portfolio").insert({
    symbol: (body.symbol ?? "").toUpperCase(),
    exchange: body.exchange ?? "NSE",
    company_name: body.company_name ?? "",
    qty: body.qty, avg_price: body.avg_price,
    buy_date: body.buy_date ?? null,
    sector: SECTOR_MAP[(body.symbol ?? "").toUpperCase()] ?? "Other",
    notes: body.notes ?? "",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
