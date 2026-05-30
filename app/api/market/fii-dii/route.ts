import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("https://www.nseindia.com/api/fiidiiTradeReact", {
      headers: { "User-Agent":"Mozilla/5.0","Referer":"https://www.nseindia.com/" },
      next: { revalidate: 600 },
    });
    const raw: { date: string; category: string; netValue: string }[] = await res.json();
    const byDate: Record<string, { date: string; fiiNetEquity: number; diiNetEquity: number }> = {};
    for (const r of raw) {
      if (!r.date) continue;
      byDate[r.date] ??= { date: r.date, fiiNetEquity: 0, diiNetEquity: 0 };
      const net = parseFloat(r.netValue ?? "0") || 0;
      if (r.category?.includes("FII")) byDate[r.date].fiiNetEquity = net;
      else if (r.category?.includes("DII")) byDate[r.date].diiNetEquity = net;
    }
    const data = Object.values(byDate).sort((a,b) => a.date.localeCompare(b.date)).slice(-10);
    // Persist to Supabase
    for (const row of data) {
      await supabase.from("fii_dii_history").upsert({ date: row.date, fii_net: row.fiiNetEquity, dii_net: row.diiNetEquity });
    }
    return NextResponse.json({ data, note: "Source: NSE India" });
  } catch {
    const { data } = await supabase.from("fii_dii_history").select("*").order("date", { ascending: false }).limit(10);
    return NextResponse.json({ data: data ?? [], note: "Cached data" });
  }
}
