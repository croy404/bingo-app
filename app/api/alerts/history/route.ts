import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data } = await supabase.from("alert_history").select("*").order("triggered_at", { ascending: false }).limit(100);
  return NextResponse.json(data ?? []);
}
export async function DELETE() {
  await supabase.from("alert_history").delete().neq("id", 0);
  return NextResponse.json({ message: "Cleared" });
}
