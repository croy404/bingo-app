import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { yahooQuote, xirrNewton, istToday } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data: rows } = await supabase.from("portfolio").select("*").order("symbol");
  if (!rows) return NextResponse.json({ holdings: [], summary: {} });
  let ti = 0, tc = 0;
  const holdings = await Promise.all(rows.map(async (row) => {
    const q = await yahooQuote(`${row.symbol}.${row.exchange === "BSE" ? "BO" : "NS"}`);
    const ltp = q.ltp || row.avg_price;
    const inv = row.qty * row.avg_price, cur = row.qty * ltp;
    const pnl = cur - inv, pct = inv ? pnl / inv * 100 : 0;
    ti += inv; tc += cur;
    let xirr = null;
    if (row.buy_date) {
      try {
        const bd = new Date(row.buy_date);
        xirr = xirrNewton([{ amount: -inv, date: bd }, { amount: cur, date: new Date() }]);
      } catch { /* skip */ }
    }
    return { ...row, ltp: +ltp.toFixed(2), invested: +inv.toFixed(2), current: +cur.toFixed(2),
             pnl: +pnl.toFixed(2), pnlPercent: +pct.toFixed(2), xirr: xirr ? +(xirr*100).toFixed(2) : null };
  }));
  const op = tc - ti;
  await supabase.from("portfolio_snapshots").upsert({
    snapshot_date: istToday(), total_value: +tc.toFixed(2), invested_value: +ti.toFixed(2),
    pnl: +op.toFixed(2), pnl_percent: ti ? +(op/ti*100).toFixed(2) : 0,
  });
  return NextResponse.json({
    holdings,
    summary: { totalInvested: +ti.toFixed(2), totalCurrent: +tc.toFixed(2),
               totalPnl: +op.toFixed(2), totalPnlPercent: ti ? +(op/ti*100).toFixed(2) : 0 },
  });
}
