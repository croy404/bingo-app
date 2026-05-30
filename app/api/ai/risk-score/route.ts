import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function POST() {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const { data: holdings } = await supabase.from("portfolio").select("symbol,qty,avg_price,sector");
  if (!holdings?.length) return NextResponse.json({ error: "No holdings" }, { status: 400 });
  const block = holdings.map(h => `${h.symbol} [${h.sector ?? ""}]: qty ${h.qty} @ ₹${h.avg_price}`).join("\n");
  try {
    const r = await askAI(
      `Portfolio:\n${block}\n\nReturn ONLY JSON: {overallScore:number(0-100),verdict:'high-risk'|'moderate'|'well-diversified',topRisks:[],suggestedActions:[]}`,
      "You are an Indian equity risk manager. Return strict JSON.", 400, "portfolio_analysis");
    const t = r.text; const s = t.indexOf("{"); const e = t.lastIndexOf("}") + 1;
    const data = s >= 0 ? JSON.parse(t.slice(s, e)) : {};
    return NextResponse.json({ ...data, provider: r.provider });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
