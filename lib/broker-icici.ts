/**
 * ICICI Breeze broker integration (serverless-adapted)
 * - Sessions persisted in Supabase broker_sessions
 * - Security Master symbol mapping cached in Supabase symbols table
 * - REST LTP + historical (no persistent WebSocket on serverless)
 */
import crypto from "crypto";
import { supabase } from "./supabase";

const BREEZE_BASE = "https://api.icicidirect.com/breezeapi/api/v1";
export const SECURITY_MASTER_URL = "https://directlink.icicidirect.com/NewSecurityMaster/SecurityMaster.zip";

export interface BreezeSession {
  apiKey: string;
  apiSecret: string;
  apiSessionToken: string;
  sessionToken: string;
  iciUserId: string;
  userName: string;
}

// Static fallback overrides (NSE symbol → ICICI ShortName), used before/if Security Master unavailable
export const SYMBOL_OVERRIDES: Record<string, string> = {
  RELIANCE:"RELIND",HDFCBANK:"HDFBAN",TCS:"TCS",INFY:"INFTEC",ICICIBANK:"ICIBAN",
  BAJFINANCE:"BAJFI",BAJAJFINSV:"BAFINS","BAJAJ-AUTO":"BAAUTO",TATAMOTORS:"TATMOT",
  TATASTEEL:"TATSTE",SUNPHARMA:"SUNPHA",TECHM:"TECMAH",ULTRACEMCO:"ULTCEM",
  HCLTECH:"HCLTEC",KOTAKBANK:"KOTMAH",ASIANPAINT:"ASIPAI",ADANIPORTS:"ADAPOR",
  ADANIENT:"ADAENT",JSWSTEEL:"JSWSTE",NESTLEIND:"NESIND",AXISBANK:"AXIOFS",
  POWERGRID:"POWGRI",HINDALCO:"HINDAL",COALINDIA:"COAOFS","M&M":"MAHMAH",
  LT:"LARTOU",SBIN:"STABAN",WIPRO:"WIPRO",ONGC:"ONGOFS",NTPC:"NTPC",BPCL:"BHAPET",
  BHARTIARTL:"BHAAIR",INDUSINDBK:"INDBA",DRREDDY:"DRREDD",CIPLA:"CIPLA",
  HEROMOTOCO:"HERHON",MARUTI:"MARUTI",TITAN:"TITIND",DIVISLAB:"DIVLAB",
  APOLLOHOSP:"APOHOS",TATACONSUM:"TATGLO",HDFCLIFE:"HDLOFS",SBILIFE:"SBIOFS",
  SHRIRAMFIN:"SHRTRA",BEL:"BHAELE",TRENT:"TRENT",ZOMATO:"ZOMATO",HINDUNILVR:"HINLEV",
  BRITANNIA:"BRIIND",EICHERMOT:"EICMOT",GRASIM:"GRASIM",ITC:"ITC",
  BANKNIFTY:"CNXBAN",NIFTY:"NIFTY",FINNIFTY:"FINNIFTY",
};

const INDEX_SYMBOLS = new Set(["NIFTY","NIFTY50","BANKNIFTY","CNXBAN","FINNIFTY","MIDCPNIFTY","SENSEX","BSESN"]);

export function getLoginUrl(apiKey: string): string {
  return `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(apiKey)}`;
}

function breezeTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function breezeHeaders(apiKey: string, sessionToken: string, apiSecret: string, body: string): Record<string, string> {
  const ts = breezeTimestamp();
  const checksum = crypto.createHash("sha256").update(ts + body + apiSecret).digest("hex");
  return {
    "Content-Type": "application/json",
    "X-Checksum": `token ${checksum}`,
    "X-Timestamp": ts,
    "X-AppKey": apiKey,
    "X-SessionToken": sessionToken,
  };
}

/** Exchange the apiSessionToken (from ICICI login) for a real session via customerdetails */
export async function generateSession(apiKey: string, apiSecret: string, apiSessionToken: string): Promise<BreezeSession> {
  const body = JSON.stringify({ SessionToken: apiSessionToken, AppKey: apiKey });
  // Breeze customerdetails is GET with a JSON body — fetch supports body on GET via duplex
  const res = await fetch(`${BREEZE_BASE}/customerdetails`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    body,
    // @ts-expect-error - duplex required for GET+body in undici
    duplex: "half",
  });
  const data = await res.json();
  if (!data.Success) throw new Error(`Breeze auth error: ${data.Error ?? "Unknown"}`);
  const s = data.Success;
  const session: BreezeSession = {
    apiKey, apiSecret, apiSessionToken,
    sessionToken: s.session_token,
    iciUserId: s.idirect_userid,
    userName: s.idirect_user_name,
  };
  // Persist to Supabase (single-user app → one row)
  await supabase.from("broker_sessions").delete().eq("broker", "icici");
  await supabase.from("broker_sessions").insert({ broker: "icici", session_data: session });
  return session;
}

export async function getSession(): Promise<BreezeSession | null> {
  const { data } = await supabase.from("broker_sessions").select("session_data").eq("broker", "icici").maybeSingle();
  return (data?.session_data as BreezeSession) ?? null;
}

export async function clearSession(): Promise<void> {
  await supabase.from("broker_sessions").delete().eq("broker", "icici");
}

/** Resolve NSE symbol → ICICI trading code using cached Security Master, then overrides */
export async function resolveSymbol(nseSymbol: string): Promise<string> {
  const upper = nseSymbol.toUpperCase().trim();
  const { data } = await supabase.from("symbols").select("token").eq("symbol", upper).eq("exchange", "ICICI").maybeSingle();
  if (data?.token) return data.token;
  return SYMBOL_OVERRIDES[upper] ?? upper;
}

export interface BreezeQuote {
  symbol: string; ltp: number; open: number; high: number; low: number;
  close: number; change: number; changePercent: number; volume: number;
}

export async function breezeLtp(nseSymbol: string, exchange = "NSE"): Promise<BreezeQuote | null> {
  const session = await getSession();
  if (!session) return null;
  const clean = nseSymbol.replace(/-(?:SM|ST)$/i, "");
  const stockCode = await resolveSymbol(clean);
  const isIndex = INDEX_SYMBOLS.has(nseSymbol.toUpperCase()) || INDEX_SYMBOLS.has(stockCode.toUpperCase());
  const body = JSON.stringify({
    stock_code: stockCode, exchange_code: exchange,
    product_type: isIndex ? "Index" : "Cash",
    expiry_date: "", right: "others", strike_price: "0",
  });
  try {
    const res = await fetch(`${BREEZE_BASE}/quotes`, {
      method: "GET",
      headers: breezeHeaders(session.apiKey, session.sessionToken, session.apiSecret, body),
      body,
      // @ts-expect-error duplex
      duplex: "half",
    });
    const data = await res.json();
    if (!data.Success?.length) return null;
    const q = data.Success[0];
    const ltp = Number(q.ltp), prev = Number(q.previous_close);
    return {
      symbol: nseSymbol.toUpperCase(), ltp, open: Number(q.open), high: Number(q.high),
      low: Number(q.low), close: prev, change: ltp - prev,
      changePercent: Number(q.ltp_percent_change), volume: Number(q.total_quantity_traded),
    };
  } catch { return null; }
}

export async function breezeHistorical(
  nseSymbol: string, exchange: string, interval: "1minute"|"5minute"|"30minute"|"1day",
  fromDate: Date, toDate: Date
): Promise<{ datetime: string; open: number; high: number; low: number; close: number; volume: number }[]> {
  const session = await getSession();
  if (!session) return [];
  const isDeriv = exchange === "NFO" || exchange === "BFO";
  const stockCode = isDeriv ? nseSymbol.toUpperCase() : await resolveSymbol(nseSymbol);
  const isIndex = !isDeriv && (INDEX_SYMBOLS.has(nseSymbol.toUpperCase()) || INDEX_SYMBOLS.has(stockCode.toUpperCase()));
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, ".000Z");
  const body = JSON.stringify({
    interval, from_date: fmt(fromDate), to_date: fmt(toDate),
    stock_code: stockCode, exchange_code: exchange,
    product_type: isDeriv ? "Futures" : isIndex ? "Index" : "Cash",
    expiry_date: "", right: "others", strike_price: "0",
  });
  try {
    const res = await fetch(`${BREEZE_BASE}/historicalcharts`, {
      method: "GET",
      headers: breezeHeaders(session.apiKey, session.sessionToken, session.apiSecret, body),
      body,
      // @ts-expect-error duplex
      duplex: "half",
    });
    const data = await res.json();
    return (data.Success ?? []).map((c: Record<string, string>) => ({
      datetime: c.datetime, open: Number(c.open), high: Number(c.high),
      low: Number(c.low), close: Number(c.close), volume: Number(c.volume) || 0,
    }));
  } catch { return []; }
}
