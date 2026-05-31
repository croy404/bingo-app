import { NextResponse } from "next/server";
import { recentFilings } from "@/lib/filings";
export const dynamic = "force-dynamic";
export async function GET() {
  const rows = await recentFilings(50);
  return NextResponse.json(rows.map(r => ({
    id: r.id, exchange: r.exchange, symbol: r.symbol, company: r.company,
    category: r.category, subject: r.subject, attachment: r.attachment,
    filingTime: r.filingTime, createdAt: r.createdAt,
  })));
}
