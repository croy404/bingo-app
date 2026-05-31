/**
 * ICICI Breeze broker integration (serverless-adapted)
 * - Sessions persisted in Supabase broker_sessions
 * - Security Master symbol mapping cached in Supabase symbols table
 * - REST LTP + historical (no persistent WebSocket on serverless)
 */
import crypto from "crypto";
import https from "https";
import { prisma } from "./db";

const BREEZE_BASE = "https://api.icicidirect.com/breezeapi/api/v1";

/**
 * ICICI Breeze uses non-standard GET requests that carry a JSON body
 * (customerdetails / quotes / historicalcharts). Node's fetch (undici) forbids
 * a body on GET, so we use the raw https module which permits it.
 */
function breezeRequest(method: string, urlStr: string, body: string, headers: Record<string, string>, timeoutMs = 12000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error("Breeze: invalid JSON — " + data.slice(0, 200))); }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("Breeze request timeout")); });
    if (body) req.write(body);
    req.end();
  });
}
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
  // Breeze customerdetails is a GET request that carries a JSON body.
  const data = (await breezeRequest("GET", `${BREEZE_BASE}/customerdetails`, body, { "Content-Type": "application/json" })) as {
    Success?: { session_token: string; idirect_userid: string; idirect_user_name: string }; Error?: string;
  };
  if (!data.Success) throw new Error(`Breeze auth error: ${data.Error ?? "Unknown"}`);
  const s = data.Success;
  const session: BreezeSession = {
    apiKey, apiSecret, apiSessionToken,
    sessionToken: s.session_token,
    iciUserId: s.idirect_userid,
    userName: s.idirect_user_name,
  };
  // Persist (single-user app → one row per broker)
  await prisma.brokerSession.upsert({
    where: { broker: "icici" },
    create: { broker: "icici", sessionData: session as unknown as object },
    update: { sessionData: session as unknown as object },
  });
  return session;
}

export async function getSession(): Promise<BreezeSession | null> {
  const row = await prisma.brokerSession.findUnique({ where: { broker: "icici" } });
  return (row?.sessionData as unknown as BreezeSession) ?? null;
}

export async function clearSession(): Promise<void> {
  await prisma.brokerSession.deleteMany({ where: { broker: "icici" } });
}

/** Resolve NSE symbol → ICICI trading code using cached Security Master, then overrides */
export async function resolveSymbol(nseSymbol: string): Promise<string> {
  const upper = nseSymbol.toUpperCase().trim();
  const row = await prisma.symbol.findUnique({ where: { symbol_exchange: { symbol: upper, exchange: "ICICI" } } });
  if (row?.token) return row.token;
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
    const data = (await breezeRequest("GET", `${BREEZE_BASE}/quotes`, body,
      breezeHeaders(session.apiKey, session.sessionToken, session.apiSecret, body))) as { Success?: Record<string, string>[] };
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
    const data = (await breezeRequest("GET", `${BREEZE_BASE}/historicalcharts`, body,
      breezeHeaders(session.apiKey, session.sessionToken, session.apiSecret, body))) as { Success?: Record<string, string>[] };
    return (data.Success ?? []).map((c: Record<string, string>) => ({
      datetime: c.datetime, open: Number(c.open), high: Number(c.high),
      low: Number(c.low), close: Number(c.close), volume: Number(c.volume) || 0,
    }));
  } catch { return []; }
}
