import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai-provider";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: settings } = await supabase.from("settings").select("key,value");
  const cfg = Object.fromEntries((settings ?? []).map(r => [r.key, r.value]));
  if (!cfg.tg_token || !cfg.tg_chat_id) return NextResponse.json({ skipped: true, reason: "telegram_not_configured" });

  try {
    const { data: fii } = await supabase.from("fii_dii_history").select("*").order("date", { ascending: false }).limit(1);
    const fiiLine = fii?.[0] ? `FII: ₹${(fii[0].fii_net/100).toFixed(0)}Cr | DII: ₹${(fii[0].dii_net/100).toFixed(0)}Cr (${fii[0].date})` : "";
    const result = await askAI(
      `Pre-market Indian market brief for today. ${fiiLine ? `Recent ${fiiLine}.` : ""} Give: Nifty outlook, key sector themes, 2 stocks to watch, 1 risk factor. Format as 5 bullets. Max 180 words.`,
      "You are a senior Indian equity market analyst. Be concise and specific.",
      400, "market_insight"
    );
    const text = `🌅 <b>BINGO Morning Brief</b>\n━━━━━━━━━━━━━━\n${result.text}\n\n<i>via ${result.provider}</i>`;
    await fetch(`https://api.telegram.org/bot${cfg.tg_token}/sendMessage`, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ chat_id: cfg.tg_chat_id, text, parse_mode: "HTML" }),
    });
    return NextResponse.json({ sent: true, provider: result.provider });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
