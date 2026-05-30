import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isMarketHours } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMarketHours()) return NextResponse.json({ skipped: true, reason: "not_market_hours" });

  const { data: alerts } = await supabase.from("alerts").select("*").eq("is_active", true).limit(200);
  if (!alerts?.length) return NextResponse.json({ checked: 0 });

  const { data: settings } = await supabase.from("settings").select("key,value");
  const cfg = Object.fromEntries((settings ?? []).map(r => [r.key, r.value]));

  let fired = 0;
  for (const alert of alerts) {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${alert.symbol}.NS?interval=1d&range=1d`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const meta = (await res.json())?.chart?.result?.[0]?.meta ?? {};
      const ltp = meta.regularMarketPrice ?? 0;
      if (!ltp) continue;

      const c = alert.condition, p = alert.price;
      const triggered = (c===">" && ltp>p)||(c===">=" && ltp>=p)||(c==="<" && ltp<p)||(c==="<=" && ltp<=p);
      if (!triggered) continue;

      if (alert.last_triggered_at) {
        const last = new Date(alert.last_triggered_at).getTime();
        if (Date.now() - last < (alert.cooldown_mins ?? 5) * 60000) continue;
      }

      // Fire alert
      await supabase.from("alert_history").insert({ alert_id: alert.id, symbol: alert.symbol, exchange: alert.exchange, condition: c, target_price: p, triggered_ltp: ltp });
      const updates: Record<string, unknown> = { triggered_count: (alert.triggered_count ?? 0) + 1, last_triggered_at: new Date().toISOString() };
      if (alert.alert_type === "once") updates.is_active = false;
      await supabase.from("alerts").update(updates).eq("id", alert.id);

      // Telegram
      if (cfg.tg_token && cfg.tg_chat_id) {
        const msg = `⚡ <b>Alert Triggered!</b>\n📊 <b>${alert.symbol}</b> · ${alert.exchange}\n💵 LTP: ₹${ltp.toFixed(2)} ${c} ₹${p}\n🕐 ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}`;
        await fetch(`https://api.telegram.org/bot${cfg.tg_token}/sendMessage`, {
          method: "POST", headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ chat_id: cfg.tg_chat_id, text: msg, parse_mode: "HTML" }),
        });
      }
      fired++;
    } catch { /* skip */ }
  }
  return NextResponse.json({ checked: alerts.length, fired });
}
