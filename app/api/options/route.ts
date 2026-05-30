import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "NIFTY").toUpperCase();
  const expiry = searchParams.get("expiry") ?? "";
  const indices = new Set(["NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY","SENSEX"]);
  const path = indices.has(symbol) ? `option-chain-indices?symbol=${symbol}` : `option-chain-equities?symbol=${symbol}`;
  try {
    const res = await fetch(`https://www.nseindia.com/api/${path}`, {
      headers: { "User-Agent":"Mozilla/5.0","Referer":"https://www.nseindia.com/" },
      next: { revalidate: 60 },
    });
    const records = (await res.json()).records ?? {};
    const expDates: string[] = records.expiryDates ?? [];
    const underlying: number = records.underlyingValue ?? 0;
    const first = expiry && expDates.includes(expiry) ? expiry : expDates[0] ?? "";
    const chain = (records.data ?? [])
      .filter((r: { expiryDate: string }) => !first || r.expiryDate === first)
      .map((item: { strikePrice: number; CE?: Record<string, number>; PE?: Record<string, number> }) => ({
        strike: item.strikePrice,
        ce: { ltp: item.CE?.lastPrice??0, oi: item.CE?.openInterest??0, vol: item.CE?.totalTradedVolume??0, iv: item.CE?.impliedVolatility??0 },
        pe: { ltp: item.PE?.lastPrice??0, oi: item.PE?.openInterest??0, vol: item.PE?.totalTradedVolume??0, iv: item.PE?.impliedVolatility??0 },
      }));
    const tco = chain.reduce((s: number, r: { ce: { oi: number } }) => s + r.ce.oi, 0);
    const tpo = chain.reduce((s: number, r: { pe: { oi: number } }) => s + r.pe.oi, 0);
    return NextResponse.json({ symbol, underlying, expiryDates: expDates, currentExpiry: first, chain, pcr: tco ? +(tpo/tco).toFixed(2) : 0 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 502 }); }
}
