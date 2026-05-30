import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSession as iciciSession } from "@/lib/broker-icici";
import { getSession as fyersSession } from "@/lib/broker-fyers";
import { istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const [{ count: at }, { count: aa }, { count: wl }, { count: pc }, { count: it }, icici, fyers] = await Promise.all([
    supabase.from("alerts").select("*", { count: "exact", head: true }),
    supabase.from("alerts").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("watchlist").select("*", { count: "exact", head: true }),
    supabase.from("portfolio").select("*", { count: "exact", head: true }),
    supabase.from("intraday_trades").select("*", { count: "exact", head: true }).eq("trade_date", istToday()),
    iciciSession(),
    fyersSession(),
  ]);
  return NextResponse.json({
    totalAlerts: at ?? 0, activeAlerts: aa ?? 0, watchlistCount: wl ?? 0,
    portfolioCount: pc ?? 0, intradayTrades: it ?? 0,
    broker: { icici: !!icici, fyers: !!fyers, active: icici ? "icici" : fyers ? "fyers" : "none" },
  });
}
