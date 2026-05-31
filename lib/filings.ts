/**
 * NSE/BSE corporate filings (announcements) monitor.
 *
 * Always-on lightweight poll (one HTTP request per exchange) — runs in the
 * worker. New filings are deduped in the `filings` table and pushed to Telegram.
 * Because it persists what it has seen, an off-hours filing (e.g. results at
 * 6pm) is caught on the next poll AND any backlog is delivered at market open.
 *
 * If the user has a watchlist, filings are filtered to those symbols (+ indices);
 * with an empty watchlist, all filings flow through (capped).
 */
import { prisma } from "./db";

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
};

export interface NewFiling {
  exchange: string; symbol?: string; company?: string; category?: string;
  subject?: string; detail?: string; attachment?: string; filingTime?: Date; dedupeKey: string;
}

// NSE needs cookies — prime them, reuse the cookie jar within a single fetch chain.
async function nseFetch(url: string): Promise<Response> {
  // Prime cookies
  await fetch("https://www.nseindia.com/", { headers: NSE_HEADERS }).catch(() => {});
  return fetch(url, { headers: NSE_HEADERS });
}

export async function fetchNseAnnouncements(): Promise<NewFiling[]> {
  try {
    const r = await nseFetch("https://www.nseindia.com/api/corporate-announcements?index=equities");
    if (!r.ok) return [];
    const data = (await r.json()) as Array<Record<string, string>>;
    if (!Array.isArray(data)) return [];
    return data.slice(0, 60).map((a) => {
      const symbol = a.symbol ?? "";
      const subject = a.desc ?? a.subject ?? a.attchmntText ?? "";
      const dt = a.an_dt ?? a.sort_date ?? a.exchdisstime ?? "";
      const key = `NSE:${symbol}:${(subject || "").slice(0, 80)}:${dt}`.replace(/\s+/g, " ").trim();
      return {
        exchange: "NSE", symbol, company: a.sm_name ?? a.companyName ?? symbol,
        category: a.attchmntText ? "Announcement" : (a.desc ? "Announcement" : ""),
        subject, detail: a.attchmntText ?? "",
        attachment: a.attchmntFile ?? a.attchmntfile ?? "",
        filingTime: dt ? new Date(dt) : undefined, dedupeKey: key,
      };
    }).filter((f) => f.dedupeKey.length > 8);
  } catch { return []; }
}

export async function fetchBseAnnouncements(): Promise<NewFiling[]> {
  try {
    // BSE corporate announcements JSON API
    const today = new Date();
    const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=${yyyymmdd}&strScrip=&strSearch=P&strToDate=${yyyymmdd}&strType=C`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.bseindia.com/" } });
    if (!r.ok) return [];
    const json = (await r.json()) as { Table?: Array<Record<string, unknown>> };
    const rows = json.Table ?? [];
    const s = (x: unknown): string => (x == null ? "" : String(x));
    return rows.slice(0, 60).map((a) => {
      const symbol = s(a.SCRIP_CD ?? a.scrip_cd);
      const company = s(a.SLONGNAME ?? a.slongname);
      const subject = s(a.NEWSSUB ?? a.HEADLINE ?? a.News_submission_dt);
      const dt = s(a.News_submission_dt ?? a.NEWS_DT);
      const key = `BSE:${symbol}:${(subject || "").slice(0, 80)}:${dt}`.replace(/\s+/g, " ").trim();
      return {
        exchange: "BSE", symbol, company,
        category: s(a.CATEGORYNAME ?? a.Category),
        subject, detail: s(a.MORE),
        attachment: a.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${s(a.ATTACHMENTNAME)}` : "",
        filingTime: dt ? new Date(dt) : undefined, dedupeKey: key,
      };
    }).filter((f) => f.dedupeKey.length > 8);
  } catch { return []; }
}

/** Persist only unseen filings; returns the rows that were newly inserted. */
export async function ingestFilings(filings: NewFiling[]): Promise<NewFiling[]> {
  const fresh: NewFiling[] = [];
  for (const f of filings) {
    try {
      await prisma.filing.create({
        data: {
          exchange: f.exchange, symbol: f.symbol, company: f.company, category: f.category,
          subject: f.subject, detail: f.detail, attachment: f.attachment,
          filingTime: f.filingTime, dedupeKey: f.dedupeKey,
        },
      });
      fresh.push(f);
    } catch {
      // unique violation = already seen; skip
    }
  }
  return fresh;
}

/** Optional symbol filter from the user's watchlist (empty = allow all). */
export async function watchlistFilter(): Promise<Set<string> | null> {
  const wl = await prisma.watchlist.findMany({ select: { symbol: true } });
  if (!wl.length) return null;
  return new Set(wl.map((w) => w.symbol.toUpperCase()));
}

export async function recentFilings(limit = 50) {
  return prisma.filing.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
