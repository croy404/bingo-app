import { NextResponse } from "next/server";
import { symbolCount } from "@/lib/symbols";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET() {
  const total = await symbolCount();
  const byExchange: Record<string, number> = {};
  for (const ex of ["NSE", "NFO", "BSE", "MCX", "AMFI"]) {
    const { count } = await supabase.from("symbols").select("*", { count: "exact", head: true }).eq("exchange", ex);
    byExchange[ex] = count ?? 0;
  }
  return NextResponse.json({ total, byExchange });
}
