import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
export const dynamic = "force-dynamic";

// Nifty 50 indexed-return series for benchmarking the portfolio curve.
export async function GET() {
  const cached = await cacheGet<{ data: unknown[] }>("benchmark_nifty");
  if (cached) return NextResponse.json(cached);
  try {
    const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=2y", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const r = (await res.json())?.chart?.result?.[0];
    const ts: number[] = r?.timestamp ?? [];
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const points = ts.map((t, i) => ({ t, c: closes[i] })).filter(p => typeof p.c === "number" && (p.c as number) > 0);
    if (!points.length) return NextResponse.json({ data: [] });
    const first = points[0].c as number;
    const data = points.map(p => ({
      date: new Date(p.t * 1000).toISOString().slice(0, 10),
      niftyClose: p.c, niftyReturn: +(((p.c as number) / first - 1) * 100).toFixed(2),
    }));
    const out = { data };
    await cacheSet("benchmark_nifty", out, 3600);
    return NextResponse.json(out);
  } catch { return NextResponse.json({ data: [] }); }
}
