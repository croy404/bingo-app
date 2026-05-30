import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data } = await supabase.from("journal").select("*").order("trade_date", { ascending: false });
  return NextResponse.json(data ?? []);
}
export async function POST(req: Request) {
  const body = await req.json();
  let pnl = body.pnl;
  if (pnl == null && body.exit_price) {
    const mult = body.direction === "BUY" ? 1 : -1;
    pnl = mult * (body.exit_price - body.entry_price) * body.qty;
  }
  const { data } = await supabase.from("journal").insert({ ...body, pnl }).select().single();
  return NextResponse.json(data, { status: 201 });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await supabase.from("journal").delete().eq("id", id);
  return NextResponse.json({ message: "Deleted" });
}
