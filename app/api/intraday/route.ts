import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? istToday();
  const { data } = await supabase.from("intraday_trades").select("*").eq("trade_date", date).order("created_at");
  return NextResponse.json({ date, trades: data ?? [] });
}
export async function POST(req: Request) {
  const body = await req.json();
  const { data } = await supabase.from("intraday_trades").insert({
    trade_date: body.trade_date || istToday(),
    symbol: (body.symbol ?? "").toUpperCase(), exchange: body.exchange ?? "NSE",
    side: (body.side ?? "BUY").toUpperCase(), qty: body.qty, price: body.price, notes: body.notes ?? "",
  }).select().single();
  return NextResponse.json(data, { status: 201 });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await supabase.from("intraday_trades").delete().eq("id", id);
  return NextResponse.json({ message: "Deleted" });
}
