import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 300;

const FEEDS = [
  { url: "https://feeds.feedburner.com/ndtvprofit-latest", source: "NDTV Profit" },
  { url: "https://economictimes.indiatimes.com/markets/rss.cms", source: "Economic Times" },
];

function strip(s: string) { return s.replace(/<[^>]*>/g,"").replace(/&[a-z]+;/gi," ").trim(); }

export async function GET() {
  const items: { title: string; link: string; pubDate: string; description: string; source: string }[] = [];
  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed.url, { headers: { "User-Agent":"Mozilla/5.0" }, next: { revalidate: 300 } });
      const text = await r.text();
      const matches = text.matchAll(/<item>([\s\S]*?)<\/item>/gi);
      for (const m of matches) {
        const block = m[1];
        const title = strip(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
        const link = strip(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
        const pubDate = strip(block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "");
        const desc = strip(block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "").slice(0,200);
        if (title && link) items.push({ title, link, pubDate, description: desc, source: feed.source });
        if (items.length >= 30) break;
      }
    } catch { /* skip failed feed */ }
  }
  return NextResponse.json({ items: items.slice(0, 30) });
}
