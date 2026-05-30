import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
  return NextResponse.json(data ?? []);
}
export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase.from("alerts").insert({
    symbol: body.symbol.toUpperCase(), exchange: body.exchange ?? "NSE",
    condition: body.condition, price: body.price,
    alert_type: body.alert_type ?? "once", cooldown_mins: body.cooldown_mins ?? 5,
    remarks: body.remarks ?? "", tag: body.tag ?? "",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await supabase.from("alerts").delete().eq("id", id);
  return NextResponse.json({ message: "Deleted" });
}
export async function PATCH(req: Request) {
  const { id } = await req.json();
  const { data: alert } = await supabase.from("alerts").select("is_active").eq("id", id).single();
  await supabase.from("alerts").update({ is_active: !alert?.is_active }).eq("id", id);
  return NextResponse.json({ message: "Toggled" });
}
