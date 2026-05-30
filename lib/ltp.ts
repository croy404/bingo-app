/**
 * Unified LTP resolver: ICICI Breeze → Fyers → Yahoo Finance fallback
 */
import { breezeLtp, getSession as iciciSession } from "./broker-icici";
import { fyersGetQuote, toFyersSymbol, getSession as fyersSession } from "./broker-fyers";
import { yahooQuote } from "./market-data";

export interface UnifiedQuote {
  symbol: string; exchange: string; ltp: number; prevClose: number;
  change: number; changePercent: number; source: string;
}

export async function getLtp(symbol: string, exchange = "NSE"): Promise<UnifiedQuote> {
  symbol = symbol.toUpperCase();

  // 1. ICICI Breeze (real-time if logged in)
  if (await iciciSession()) {
    const q = await breezeLtp(symbol, exchange);
    if (q && q.ltp > 0) {
      return { symbol, exchange, ltp: q.ltp, prevClose: q.close, change: q.change,
               changePercent: q.changePercent, source: "icici" };
    }
  }

  // 2. Fyers (real-time if logged in)
  if (await fyersSession()) {
    const q = await fyersGetQuote(toFyersSymbol(exchange, symbol));
    if (q && q.ltp > 0) {
      const change = q.ltp - q.close;
      return { symbol, exchange, ltp: q.ltp, prevClose: q.close, change,
               changePercent: q.close ? (change / q.close) * 100 : 0, source: "fyers" };
    }
  }

  // 3. Yahoo Finance (delayed, always available)
  const yq = await yahooQuote(`${symbol}.${exchange === "BSE" ? "BO" : "NS"}`);
  const change = yq.ltp - yq.prev;
  return { symbol, exchange, ltp: yq.ltp, prevClose: yq.prev, change,
           changePercent: yq.prev ? (change / yq.prev) * 100 : 0, source: "yahoo" };
}
