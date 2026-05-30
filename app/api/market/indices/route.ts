import { NextResponse } from "next/server";
import { yahooQuote } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const revalidate = 30;

const INDICES = [
  { name: "NIFTY 50",   sym: "^NSEI",    exchange: "NSE" },
  { name: "SENSEX",     sym: "^BSESN",   exchange: "BSE" },
  { name: "BANK NIFTY", sym: "^NSEBANK", exchange: "NSE" },
  { name: "INDIA VIX",  sym: "^INDIAVIX",exchange: "NSE" },
  { name: "FINNIFTY",   sym: "^CNXFIN",  exchange: "NSE" },
  { name: "S&P 500",    sym: "^GSPC",    exchange: "US"  },
  { name: "NASDAQ",     sym: "^IXIC",    exchange: "US"  },
  { name: "DOW JONES",  sym: "^DJI",     exchange: "US"  },
  { name: "NIKKEI 225", sym: "^N225",    exchange: "JP"  },
  { name: "HANG SENG",  sym: "^HSI",     exchange: "HK"  },
];

export async function GET() {
  const results = await Promise.all(INDICES.map(async idx => {
    const q = await yahooQuote(idx.sym);
    const ch = q.ltp - q.prev;
    return { name: idx.name, exchange: idx.exchange, ltp: +q.ltp.toFixed(2),
             change: +ch.toFixed(2), changePercent: q.prev ? +(ch/q.prev*100).toFixed(2) : 0 };
  }));
  return NextResponse.json(results);
}
