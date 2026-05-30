import { NextResponse } from "next/server";
import { askAI, checkUserLimit } from "@/lib/ai-provider";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function POST() {
  if (!checkUserLimit()) return NextResponse.json({ error: "Rate limit reached" }, { status: 429 });
  const data = await prisma.journal.findMany({ orderBy: { tradeDate: "desc" }, take: 30,
    select: { tradeDate: true, symbol: true, direction: true, pnl: true, emotion: true } });
  if (!data.length) return NextResponse.json({ error: "No journal entries" }, { status: 400 });
  const block = data.map(e => `${e.tradeDate.toISOString().slice(0, 10)} | ${e.symbol} | ${e.direction} | P&L ${e.pnl ?? "n/a"}${e.emotion ? ` | ${e.emotion}` : ""}`).join("\n");
  try {
    const r = await askAI(
      `Trade journal:\n${block}\n\nIdentify: recurring mistakes/biases, positive patterns, 1 specific improvement action. Max 200 words, bullets.`,
      "You are a trading psychology coach. Be direct.", 500, "portfolio_analysis");
    return NextResponse.json({ analysis: r.text, provider: r.provider });
  } catch { return NextResponse.json({ error: "AI unavailable" }, { status: 503 }); }
}
