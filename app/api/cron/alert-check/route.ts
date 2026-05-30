import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isMarketHours } from "@/lib/market-data";
import { getLtp } from "@/lib/ltp";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMarketHours()) return NextResponse.json({ skipped: true, reason: "not_market_hours" });

  const alerts = await prisma.alert.findMany({ where: { isActive: true }, take: 200 });
  if (!alerts.length) return NextResponse.json({ checked: 0 });

  const settings = await prisma.setting.findMany();
  const cfg = Object.fromEntries(settings.map(r => [r.key, r.value]));

  let fired = 0;
  for (const alert of alerts) {
    try {
      const q = await getLtp(alert.symbol, alert.exchange);
      const ltp = q.ltp;
      if (!ltp) continue;
      const c = alert.condition, p = alert.price;
      const triggered = (c === ">" && ltp > p) || (c === ">=" && ltp >= p) || (c === "<" && ltp < p) || (c === "<=" && ltp <= p);
      if (!triggered) continue;
      if (alert.lastTriggeredAt && Date.now() - alert.lastTriggeredAt.getTime() < (alert.cooldownMins ?? 5) * 60000) continue;

      await prisma.alertHistory.create({ data: { alertId: alert.id, symbol: alert.symbol, exchange: alert.exchange, condition: c, targetPrice: p, triggeredLtp: ltp } });
      await prisma.alert.update({
        where: { id: alert.id },
        data: { triggeredCount: alert.triggeredCount + 1, lastTriggeredAt: new Date(), ...(alert.alertType === "once" ? { isActive: false } : {}) },
      });

      if (cfg.tg_token && cfg.tg_chat_id) {
        const msg = `⚡ <b>Alert Triggered!</b>\n📊 <b>${alert.symbol}</b> · ${alert.exchange}\n💵 LTP: ₹${ltp.toFixed(2)} ${c} ₹${p}\n🕐 ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
        await fetch(`https://api.telegram.org/bot${cfg.tg_token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: cfg.tg_chat_id, text: msg, parse_mode: "HTML" }),
        });
      }
      fired++;
    } catch { /* skip */ }
  }
  return NextResponse.json({ checked: alerts.length, fired });
}
