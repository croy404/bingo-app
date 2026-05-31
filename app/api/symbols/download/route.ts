import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SHOONYA_EXCHANGES } from "@/lib/symbols";
export const dynamic = "force-dynamic";

// Queue the download — the always-on worker picks it up (NFO/BFO are large and
// would exceed an HTTP timeout, so we don't run it inline).
export async function POST(req: Request) {
  let exchanges = SHOONYA_EXCHANGES;
  try { const b = await req.json(); if (Array.isArray(b.exchanges) && b.exchanges.length) exchanges = b.exchanges; } catch { /* default all */ }
  await prisma.setting.upsert({
    where: { key: "symbols_download_req" },
    create: { key: "symbols_download_req", value: JSON.stringify({ exchanges, ts: Date.now() }) },
    update: { value: JSON.stringify({ exchanges, ts: Date.now() }) },
  });
  await prisma.setting.upsert({
    where: { key: "symbols_download_status" },
    create: { key: "symbols_download_status", value: JSON.stringify({ state: "queued", exchanges }) },
    update: { value: JSON.stringify({ state: "queued", exchanges }) },
  });
  return NextResponse.json({ message: "Download queued — the worker will fetch all symbols (~30-90s). Refresh status.", exchanges });
}
