import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
export const dynamic = "force-dynamic";

async function getDailyReturns(symbol: string, exchange: string): Promise<number[]> {
  const ticker = exchange === "BSE" ? `${symbol}.BO` : `${symbol}.NS`;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2mo`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const closes = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []) as (number | null)[];
    const valid = closes.filter((c): c is number => c != null && c > 0);
    if (valid.length < 10) return [];
    return valid.slice(1).map((c, i) => (c - valid[i]) / valid[i]);
  } catch { return []; }
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const ax = a.slice(-n), bx = b.slice(-n);
  const ma = ax.reduce((s, x) => s + x, 0) / n;
  const mb = bx.reduce((s, x) => s + x, 0) / n;
  const num = ax.reduce((s, x, i) => s + (x - ma) * (bx[i] - mb), 0);
  const da = Math.sqrt(ax.reduce((s, x) => s + (x - ma) ** 2, 0));
  const db = Math.sqrt(bx.reduce((s, x) => s + (x - mb) ** 2, 0));
  return da && db ? +(num / (da * db)).toFixed(3) : 0;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("symbols") ?? "";
  const pairs = raw.split(",").filter(Boolean).slice(0, 12).map((s) => {
    const [sym, ex = "NSE"] = s.split(":");
    return { symbol: sym.toUpperCase(), exchange: ex };
  });
  if (pairs.length < 2) return NextResponse.json({ error: "Need at least 2 symbols" }, { status: 400 });

  const key = `corr_${pairs.map((p) => `${p.exchange}:${p.symbol}`).sort().join("_")}`;
  const cached = await cacheGet<unknown>(key);
  if (cached) return NextResponse.json(cached);

  const returns = await Promise.all(pairs.map((p) => getDailyReturns(p.symbol, p.exchange)));
  const symbols = pairs.map((p) => p.symbol);
  const matrix: Record<string, Record<string, number>> = {};
  for (let i = 0; i < symbols.length; i++) {
    matrix[symbols[i]] = {};
    for (let j = 0; j < symbols.length; j++) {
      matrix[symbols[i]][symbols[j]] = i === j ? 1 : pearson(returns[i], returns[j]);
    }
  }
  const result = { symbols, matrix, days: 60, source: "Yahoo Finance" };
  await cacheSet(key, result, 3600);
  return NextResponse.json(result);
}
