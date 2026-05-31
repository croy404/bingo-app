/**
 * Symbol master — comprehensive scrip master from Shoonya (Finvasia).
 *
 * Shoonya publishes complete, daily-updated scrip masters for every exchange as
 * zipped CSVs. We download, parse, and store them in the `symbols` table with
 * the trading symbol + token, which lets us build the correct streaming symbol
 * format for each broker:
 *   - Fyers:  `${EXCH}:${tradingSymbol}`     e.g. NSE:RELIANCE-EQ  (Shoonya's TradingSymbol == Fyers symbol)
 *   - ICICI:  resolved separately via the ICICI Security Master (ShortName)
 *
 * Files: NSE, BSE, NFO, BFO, MCX, CDS.
 */
import { unzipSync, strFromU8 } from "fflate";
import { prisma } from "./db";

const SHOONYA_BASE = "https://api.shoonya.com";
const EXCHANGES: Record<string, string> = {
  NSE: `${SHOONYA_BASE}/NSE_symbols.txt.zip`,
  BSE: `${SHOONYA_BASE}/BSE_symbols.txt.zip`,
  NFO: `${SHOONYA_BASE}/NFO_symbols.txt.zip`,
  BFO: `${SHOONYA_BASE}/BFO_symbols.txt.zip`,
  MCX: `${SHOONYA_BASE}/MCX_symbols.txt.zip`,
  CDS: `${SHOONYA_BASE}/CDS_symbols.txt.zip`,
};

type SymRow = { symbol: string; name: string; exchange: string; type: string; series?: string; isin?: string; token?: string };

async function bulkUpsert(rows: SymRow[]) {
  for (let i = 0; i < rows.length; i += 2000) {
    await prisma.symbol.createMany({ data: rows.slice(i, i + 2000), skipDuplicates: true });
  }
}

/** Download + parse one exchange's Shoonya scrip master. */
export async function downloadShoonya(exchange: string): Promise<number> {
  const url = EXCHANGES[exchange];
  if (!url) return 0;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${exchange} download HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf);
  const name = Object.keys(files)[0];
  if (!name) return 0;
  const text = strFromU8(files[name]);

  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return 0;
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iExch = col("exchange");
  const iToken = col("token");
  const iSymbol = col("symbol");                       // underlying name
  const iTrading = col("tradingsymbol", "trading symbol");
  const iInstr = col("instrument", "instname");
  const iLot = col("lotsize", "lot size");
  const iIsin = col("isin");

  const rows: SymRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const p = lines[li].split(",");
    const trading = (iTrading >= 0 ? p[iTrading] : p[iSymbol] ?? "")?.trim();
    if (!trading) continue;
    rows.push({
      symbol: trading.toUpperCase(),
      name: (iSymbol >= 0 ? p[iSymbol] : trading)?.trim() ?? trading,
      exchange,
      type: (iInstr >= 0 ? p[iInstr] : "EQ")?.trim() || "EQ",
      series: iLot >= 0 ? (p[iLot] ?? "").trim() : undefined,
      isin: iIsin >= 0 ? (p[iIsin] ?? "").trim() : undefined,
      token: iToken >= 0 ? (p[iToken] ?? "").trim() : undefined,
    });
  }
  // Replace this exchange's old rows, then insert fresh
  await prisma.symbol.deleteMany({ where: { exchange } });
  await bulkUpsert(rows);
  return rows.length;
}

export async function downloadAll(exchanges: string[]): Promise<Record<string, number | string>> {
  const result: Record<string, number | string> = {};
  for (const ex of exchanges) {
    try { result[ex] = await downloadShoonya(ex); }
    catch (e) { result[ex] = `error: ${String(e).slice(0, 80)}`; }
  }
  return result;
}

export async function searchSymbols(query: string, exchange?: string, limit = 20) {
  const q = query.toUpperCase().trim();
  return prisma.symbol.findMany({
    where: { symbol: { startsWith: q }, ...(exchange ? { exchange: exchange.toUpperCase() } : {}) },
    select: { symbol: true, name: true, exchange: true, type: true, isin: true, token: true },
    take: limit,
  });
}

export async function symbolCount(): Promise<number> {
  return prisma.symbol.count();
}

/** Build the Fyers streaming symbol for a stored row (TradingSymbol is already Fyers-style). */
export function toFyersStreamSymbol(exchange: string, tradingSymbol: string): string {
  return `${exchange.toUpperCase()}:${tradingSymbol.toUpperCase()}`;
}

export const SHOONYA_EXCHANGES = Object.keys(EXCHANGES);

/**
 * Resolve the exchange token for a plain symbol (e.g. RELIANCE / NSE).
 * NSE/BSE equity tokens from Shoonya == the tokens ICICI Breeze livestream uses,
 * so this drives Breeze WebSocket subscriptions. Tries TRADINGSYMBOL "-EQ" then name.
 */
export async function getExchangeToken(symbol: string, exchange: string): Promise<string | null> {
  const sym = symbol.toUpperCase().trim();
  const ex = exchange.toUpperCase();
  const row = await prisma.symbol.findFirst({
    where: { exchange: ex, OR: [{ symbol: `${sym}-EQ` }, { symbol: sym }, { name: sym, type: "EQ" }] },
    select: { token: true },
  });
  return row?.token || null;
}
