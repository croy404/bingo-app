import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data } = await supabase.from("watchlist").select("*").order("symbol");
  return NextResponse.json(data ?? []);
}
export async function POST(req: Request) {
  const { symbol, exchange = "NSE" } = await req.json();
  await supabase.from("watchlist").upsert({ symbol: symbol.toUpperCase(), exchange }, { onConflict: "symbol,exchange" });
  return NextResponse.json({ message: "Added" });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await supabase.from("watchlist").delete().eq("id", id);
  return NextResponse.json({ message: "Deleted" });
}
