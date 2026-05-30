/** NSE market data helpers — used by API routes */
const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  "Referer": "https://www.nseindia.com/",
};

export async function nseGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://www.nseindia.com/api${path}`, {
    headers: NSE_HEADERS, next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`NSE ${path} → ${res.status}`);
  return res.json();
}

export async function yahooQuote(sym: string): Promise<{ ltp: number; prev: number }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 30 } }
    );
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta ?? {};
    return { ltp: meta.regularMarketPrice ?? 0, prev: meta.previousClose ?? 0 };
  } catch { return { ltp: 0, prev: 0 }; }
}

export const IST_OFFSET = 5.5 * 60 * 60 * 1000;
export function istNow() { return new Date(Date.now() + IST_OFFSET); }
export function istToday() { return istNow().toISOString().slice(0, 10); }

export const NSE_HOLIDAYS = new Set([
  "20250126","20250219","20250314","20250331","20250414","20250418",
  "20250501","20250815","20250827","20251002","20251024","20251025",
  "20251105","20251225","20260126","20260302","20260403","20260501",
  "20260815","20261002","20261225",
]);

export function isMarketHours(): boolean {
  const ist = istNow();
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const dk = `${ist.getUTCFullYear()}${String(ist.getUTCMonth()+1).padStart(2,"0")}${String(ist.getUTCDate()).padStart(2,"0")}`;
  if (NSE_HOLIDAYS.has(dk)) return false;
  const t = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return t >= 555 && t < 930;
}

export function marketStatus() {
  const ist = istNow();
  const day = ist.getUTCDay();
  const t = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const dk = `${ist.getUTCFullYear()}${String(ist.getUTCMonth()+1).padStart(2,"0")}${String(ist.getUTCDate()).padStart(2,"0")}`;
  const isWk = day === 0 || day === 6;
  const isHol = NSE_HOLIDAYS.has(dk);
  const isOpen = !isWk && !isHol && t >= 555 && t < 930;
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  let msg = "";
  if (isWk) msg = "Market closed (weekend)";
  else if (isHol) msg = "Market closed (NSE holiday)";
  else if (t < 555) { const d = 555 - t; msg = `Market opens in ${Math.floor(d/60)}h ${d%60}m`; }
  else if (t >= 930) msg = "Market closed for the day";
  else { const d = 930 - t; msg = `Market closes in ${Math.floor(d/60)}h ${d%60}m`; }
  return { isOpen, message: msg, currentTime: ist.toISOString(), dayName: days[day], isTradingDay: !isWk && !isHol };
}

export const SECTOR_MAP: Record<string, string> = {
  RELIANCE:"Energy",TCS:"IT",HDFCBANK:"Bank",BHARTIARTL:"Telecom",ICICIBANK:"Bank",
  INFOSYS:"IT",INFY:"IT",HINDUNILVR:"FMCG",ITC:"FMCG",SBIN:"Bank",LT:"Infra",
  KOTAKBANK:"Bank",AXISBANK:"Bank",BAJFINANCE:"Finance",BAJAJFINSV:"Finance",
  ASIANPAINT:"Chemical",MARUTI:"Auto",NTPC:"Energy",TITAN:"Consumer",
  SUNPHARMA:"Pharma",WIPRO:"IT",POWERGRID:"Utilities",ULTRACEMCO:"Cement",
  ADANIENT:"Conglomerate",ADANIPORTS:"Infra",TECHM:"IT",HCLTECH:"IT",
  TATAMOTORS:"Auto",TATASTEEL:"Metal",GRASIM:"Cement",JSWSTEEL:"Metal",
  COALINDIA:"Energy",ONGC:"Energy",BPCL:"Energy",EICHERMOT:"Auto",
  HEROMOTOCO:"Auto",DIVISLAB:"Pharma",BRITANNIA:"FMCG",NESTLEIND:"FMCG",
  CIPLA:"Pharma",SHRIRAMFIN:"Finance","M&M":"Auto",DRREDDY:"Pharma",
  APOLLOHOSP:"Health",TATACONSUM:"FMCG",INDUSINDBK:"Bank",HINDALCO:"Metal",
  UPL:"Chemical",SBILIFE:"Insurance",HDFCLIFE:"Insurance","BAJAJ-AUTO":"Auto",
  ZOMATO:"Consumer",TRENT:"Retail",BEL:"Defence",DMART:"Retail",
};

// XIRR Newton-Raphson
export function xirrNewton(cashflows: { amount: number; date: Date }[]): number | null {
  if (cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();
  const years = (d: Date) => (d.getTime() - t0) / (365.25 * 86400000);
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const npv = sorted.reduce((s, cf) => s + cf.amount / Math.pow(1 + r, years(cf.date)), 0);
    const dnpv = sorted.reduce((s, cf) => s - years(cf.date) * cf.amount / (Math.pow(1+r, years(cf.date)) * (1+r)), 0);
    if (Math.abs(dnpv) < 1e-12) return null;
    const delta = npv / dnpv; r -= delta;
    if (!isFinite(r) || r < -1) return null;
    if (Math.abs(delta) < 1e-7) break;
  }
  return isFinite(r) && r > -0.99 && r < 10 ? r : null;
}
