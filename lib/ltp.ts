/**
 * Unified LTP resolver: ICICI Breeze → Fyers → Yahoo Finance fallback.
 *
 * Cost/load control: outside the app-active window (08:55–15:45 IST on trading
 * days) we do NOT hit any external API. We serve the last-known quote that the
 * worker streamed into Redis (key price:EXCHANGE:SYMBOL). This keeps NSE/Yahoo
 * API load and AI spend to market hours only.
 */
import { breezeLtp, getSession as iciciSession } from "./broker-icici";
import { fyersGetQuote, toFyersSymbol, getSession as fyersSession } from "./broker-fyers";
import { yahooQuote, isAppActive } from "./market-data";
import { cacheGet, cacheSet } from "./redis";

export interface UnifiedQuote {
  symbol: string; exchange: string; ltp: number; prevClose: number;
  change: number; changePercent: number; source: string; live: boolean;
}

async function lastKnown(symbol: string, exchange: string): Promise<UnifiedQuote> {
  const cached = await cacheGet<UnifiedQuote>(`price:${exchange}:${symbol}`);
  if (cached) return { ...cached, live: false, source: cached.source + "_cached" };
  return { symbol, exchange, ltp: 0, prevClose: 0, change: 0, changePercent: 0, source: "closed", live: false };
}

export async function getLtp(symbol: string, exchange = "NSE", opts: { force?: boolean } = {}): Promise<UnifiedQuote> {
  symbol = symbol.toUpperCase();

  // Outside the active window: serve last-known snapshot, make NO external calls.
  if (!opts.force && !isAppActive()) {
    return lastKnown(symbol, exchange);
  }

  // 1. ICICI Breeze (real-time if logged in)
  if (await iciciSession()) {
    const q = await breezeLtp(symbol, exchange);
    if (q && q.ltp > 0) {
      const r = { symbol, exchange, ltp: q.ltp, prevClose: q.close, change: q.change,
                  changePercent: q.changePercent, source: "icici", live: true };
      await cacheSet(`price:${exchange}:${symbol}`, r, 86400);
      return r;
    }
  }

  // 2. Fyers (real-time if logged in)
  if (await fyersSession()) {
    const q = await fyersGetQuote(toFyersSymbol(exchange, symbol));
    if (q && q.ltp > 0) {
      const change = q.ltp - q.close;
      const r = { symbol, exchange, ltp: q.ltp, prevClose: q.close, change,
                  changePercent: q.close ? (change / q.close) * 100 : 0, source: "fyers", live: true };
      await cacheSet(`price:${exchange}:${symbol}`, r, 86400);
      return r;
    }
  }

  // 3. Yahoo Finance (delayed, always available)
  const yq = await yahooQuote(`${symbol}.${exchange === "BSE" ? "BO" : "NS"}`);
  const change = yq.ltp - yq.prev;
  const r = { symbol, exchange, ltp: yq.ltp, prevClose: yq.prev, change,
              changePercent: yq.prev ? (change / yq.prev) * 100 : 0, source: "yahoo", live: true };
  if (yq.ltp > 0) await cacheSet(`price:${exchange}:${symbol}`, r, 86400);
  return r;
}
