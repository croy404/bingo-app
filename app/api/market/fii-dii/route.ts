import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/redis";
export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await cacheGet<{ data: unknown[]; note: string }>("fii_dii");
  if (cached) return NextResponse.json(cached);
  try {
    const res = await fetch("https://www.nseindia.com/api/fiidiiTradeReact", {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com/" },
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
    const data = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
    for (const row of data) {
      // NSE date format is "DD-MMM-YYYY" — store as-is keyed date via a parsed Date if possible
      const d = new Date(row.date);
      if (!isNaN(d.getTime())) {
        await prisma.fiiDiiHistory.upsert({
          where: { date: d },
          create: { date: d, fiiNet: row.fiiNetEquity, diiNet: row.diiNetEquity },
          update: { fiiNet: row.fiiNetEquity, diiNet: row.diiNetEquity },
        });
      }
    }
    const result = { data, note: "Source: NSE India" };
    await cacheSet("fii_dii", result, 600);
    return NextResponse.json(result);
  } catch {
    const rows = await prisma.fiiDiiHistory.findMany({ orderBy: { date: "desc" }, take: 10 });
    return NextResponse.json({ data: rows.map(r => ({ date: r.date.toISOString().slice(0, 10), fiiNetEquity: r.fiiNet, diiNetEquity: r.diiNet })), note: "Cached" });
  }
}
