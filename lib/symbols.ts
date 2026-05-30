/**
 * Symbol master download → Supabase symbols table
 * Sources: NSE equity, NSE F&O, BSE, MCX, AMFI mutual funds
 */
import { prisma } from "./db";

const NSE_HEADERS = { "User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com/" };

type SymRow = { symbol: string; name: string; exchange: string; type: string; series?: string; isin?: string; token?: string };

async function bulkUpsert(rows: SymRow[]) {
  // createMany with skipDuplicates is fast; uniqueness on (symbol, exchange)
  for (let i = 0; i < rows.length; i += 1000) {
    await prisma.symbol.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
  }
}

export async function downloadNseEquity(): Promise<number> {
  const res = await fetch("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv", { headers: NSE_HEADERS });
  const text = await res.text();
  const lines = text.split("\n").slice(1).filter(l => l.trim());
  const rows: SymRow[] = [];
  for (const line of lines) {
    const c = line.split(",");
    if (!c[0]) continue;
    rows.push({ symbol: c[0].trim().toUpperCase(), name: (c[1] ?? "").trim(),
                exchange: "NSE", type: "equity", series: (c[2] ?? "EQ").trim(), isin: (c[6] ?? "").trim() });
  }
  await bulkUpsert(rows);
  return rows.length;
}

export async function downloadNseFO(): Promise<number> {
  const FO = ["NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY","SENSEX","RELIANCE","TCS","HDFCBANK","ICICIBANK","INFY",
    "BHARTIARTL","KOTAKBANK","HINDUNILVR","ITC","AXISBANK","BAJFINANCE","MARUTI","NTPC","TITAN","SUNPHARMA","WIPRO",
    "POWERGRID","ULTRACEMCO","ADANIENT","ADANIPORTS","TECHM","HCLTECH","TATAMOTORS","TATASTEEL","GRASIM","JSWSTEEL",
    "COALINDIA","ONGC","BPCL","EICHERMOT","HEROMOTOCO","DIVISLAB","BRITANNIA","NESTLEIND","CIPLA","SBIN","LT","M&M",
    "DRREDDY","APOLLOHOSP","TATACONSUM","INDUSINDBK","HINDALCO","UPL","SBILIFE","HDFCLIFE","BAJAJ-AUTO","ZOMATO","TRENT"];
  const rows: SymRow[] = FO.map(s => ({ symbol: s, name: s, exchange: "NFO", type: "derivative", series: "FUT" }));
  await bulkUpsert(rows);
  return rows.length;
}

export async function downloadBse(): Promise<number> {
  // BSE active equity list (well-known large caps; full list requires authenticated BSE API)
  const BSE: [string, string, string][] = [
    ["500325","RELIANCE","Reliance Industries"],["500180","HDFCBANK","HDFC Bank"],["532540","TCS","TCS"],
    ["500209","INFY","Infosys"],["532174","ICICIBANK","ICICI Bank"],["500182","HINDUNILVR","HUL"],
    ["500875","ITC","ITC"],["500112","SBIN","SBI"],["500510","LT","Larsen & Toubro"],["532538","ULTRACEMCO","UltraTech"],
    ["500247","KOTAKBANK","Kotak Bank"],["532215","AXISBANK","Axis Bank"],["500034","BAJFINANCE","Bajaj Finance"],
    ["532500","MARUTI","Maruti Suzuki"],["500570","TATAMOTORS","Tata Motors"],["500470","TATASTEEL","Tata Steel"],
  ];
  const rows: SymRow[] = BSE.map(([token, sym, name]) => ({ symbol: sym, name, exchange: "BSE", type: "equity", token }));
  await bulkUpsert(rows);
  return rows.length;
}

export async function downloadMcx(): Promise<number> {
  const MCX: [string, string][] = [
    ["GOLD","Gold"],["SILVER","Silver"],["CRUDEOIL","Crude Oil"],["NATURALGAS","Natural Gas"],["COPPER","Copper"],
    ["ZINC","Zinc"],["LEAD","Lead"],["NICKEL","Nickel"],["ALUMINIUM","Aluminium"],["COTTON","Cotton"],
    ["MENTHAOIL","Mentha Oil"],["CARDAMOM","Cardamom"],["GOLDM","Gold Mini"],["SILVERM","Silver Mini"],
  ];
  const rows: SymRow[] = MCX.map(([sym, name]) => ({ symbol: sym, name, exchange: "MCX", type: "commodity" }));
  await bulkUpsert(rows);
  return rows.length;
}

export async function downloadAmfi(): Promise<number> {
  const res = await fetch("https://www.amfiindia.com/spages/NAVAll.txt");
  const text = await res.text();
  const rows: SymRow[] = [];
  for (const line of text.split("\n")) {
    const p = line.split(";");
    if (p.length < 4) continue;
    const code = p[0].trim();
    if (!code || !/^\d+$/.test(code)) continue;
    rows.push({ symbol: code, name: (p[3] ?? p[0]).trim().slice(0, 100), exchange: "AMFI", type: "mutual_fund", isin: (p[1] ?? "").trim() });
  }
  await bulkUpsert(rows);
  return rows.length;
}

export async function downloadAll(exchanges: string[]): Promise<Record<string, number | string>> {
  const result: Record<string, number | string> = {};
  const tasks: [string, () => Promise<number>][] = [];
  if (exchanges.includes("NSE")) tasks.push(["NSE", downloadNseEquity]);
  if (exchanges.includes("NFO") || exchanges.includes("FO")) tasks.push(["NFO", downloadNseFO]);
  if (exchanges.includes("BSE")) tasks.push(["BSE", downloadBse]);
  if (exchanges.includes("MCX")) tasks.push(["MCX", downloadMcx]);
  if (exchanges.includes("MF") || exchanges.includes("AMFI")) tasks.push(["AMFI", downloadAmfi]);
  for (const [name, fn] of tasks) {
    try { result[name] = await fn(); } catch (e) { result[name] = `error: ${String(e).slice(0, 80)}`; }
  }
  return result;
}

export async function searchSymbols(query: string, exchange?: string, limit = 20) {
  const q = query.toUpperCase().trim();
  return prisma.symbol.findMany({
    where: { symbol: { startsWith: q }, ...(exchange ? { exchange: exchange.toUpperCase() } : {}) },
    select: { symbol: true, name: true, exchange: true, type: true, isin: true },
    take: limit,
  });
}

export async function symbolCount(): Promise<number> {
  return prisma.symbol.count();
}
