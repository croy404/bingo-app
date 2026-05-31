/**
 * Fyers broker integration (serverless-adapted)
 * - OAuth token exchange (SHA-256 appIdHash)
 * - Session in Supabase broker_sessions
 * - REST quote + historical
 */
import crypto from "crypto";
import { prisma } from "./db";

const FYERS_BASE = "https://api-t1.fyers.in/api/v3";
const FYERS_DATA = "https://api-t1.fyers.in/data";

export interface FyersSession { uid: string; appId: string; accessToken: string }

export function oauthUrl(appId: string, redirectUri: string, state = "bingo"): string {
  return `${FYERS_BASE}/generate-authcode?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(state)}`;
}

export async function exchangeToken(appId: string, secretKey: string, code: string): Promise<FyersSession> {
  const appIdHash = crypto.createHash("sha256").update(`${appId}:${secretKey}`).digest("hex");
  const res = await fetch(`${FYERS_BASE}/validate-authcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "authorization_code", appIdHash, code }),
  });
  const data = await res.json();
  if (data.s !== "ok" || !data.access_token) throw new Error(data.message || "Fyers token exchange failed");
  const session: FyersSession = { uid: appId.split("-")[0] ?? appId, appId, accessToken: data.access_token };
  await prisma.brokerSession.upsert({
    where: { broker: "fyers" },
    create: { broker: "fyers", sessionData: session as unknown as object },
    update: { sessionData: session as unknown as object },
  });
  return session;
}

export async function getSession(): Promise<FyersSession | null> {
  const row = await prisma.brokerSession.findUnique({ where: { broker: "fyers" } });
  return (row?.sessionData as unknown as FyersSession) ?? null;
}

export async function clearSession(): Promise<void> {
  await prisma.brokerSession.deleteMany({ where: { broker: "fyers" } });
}

export function toFyersSymbol(exchange: string, symbol: string, series = ""): string {
  const ex = exchange.toUpperCase(), sym = symbol.toUpperCase(), ser = series.toUpperCase();
  let suffix = "-EQ";
  if (ser === "SM" || ser === "ST") suffix = "-SM";
  else if (ser === "SGB") suffix = "-SGB";
  if (ex === "NSE") return `NSE:${sym}${suffix}`;
  if (ex === "BSE") return `BSE:${sym}${suffix}`;
  return `${ex}:${sym}`;
}

/** Convert a Fyers symbol (e.g. NSE:SBIN-EQ) back to { exchange, symbol }. */
export function fromFyersSymbol(fyersSymbol: string): { exchange: string; symbol: string } {
  const [exchange, rest] = fyersSymbol.split(":");
  const symbol = (rest ?? "").replace(/-(EQ|INDEX|ETF|SM|SGB|GB)$/i, "");
  return { exchange: exchange ?? "NSE", symbol };
}

export interface FyersQuote { ltp: number; open: number; high: number; low: number; close: number; volume: number }

export async function fyersGetQuote(fyersSymbol: string): Promise<FyersQuote | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const res = await fetch(`${FYERS_BASE}/quotes?symbols=${encodeURIComponent(fyersSymbol)}`, {
      headers: { Authorization: `${session.appId}:${session.accessToken}` },
    });
    const data = await res.json();
    if (data.s !== "ok" || !data.d?.length) return null;
    const v = data.d[0]?.v;
    if (!v) return null;
    return {
      ltp: v.lp ?? 0, open: v.open_price ?? 0, high: v.high_price ?? 0,
      low: v.low_price ?? 0, close: v.prev_close_price ?? 0, volume: v.volume ?? 0,
    };
  } catch { return null; }
}

export async function fyersHistorical(
  fyersSymbol: string, resolution: string, fromDate: Date, toDate: Date
): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[] | null> {
  const session = await getSession();
  if (!session) return null;
  const from = Math.floor(fromDate.getTime() / 1000), to = Math.floor(toDate.getTime() / 1000);
  const url = `${FYERS_DATA}/history?symbol=${encodeURIComponent(fyersSymbol)}&resolution=${resolution}&date_format=0&range_from=${from}&range_to=${to}&cont_flag=1`;
  try {
    const res = await fetch(url, { headers: { Authorization: `${session.appId}:${session.accessToken}` } });
    const data = await res.json();
    if (data.s !== "ok" || !data.candles) return null;
    return data.candles.map((c: number[]) => ({ time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }));
  } catch { return null; }
}
