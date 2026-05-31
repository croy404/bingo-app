import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { symbolCount, SHOONYA_EXCHANGES } from "@/lib/symbols";
export const dynamic = "force-dynamic";

export async function GET() {
  const total = await symbolCount();
  const byExchange: Record<string, number> = {};
  for (const ex of SHOONYA_EXCHANGES) {
    byExchange[ex] = await prisma.symbol.count({ where: { exchange: ex } });
  }
  const statusRow = await prisma.setting.findUnique({ where: { key: "symbols_download_status" } });
  let status: unknown = null;
  try { status = statusRow?.value ? JSON.parse(statusRow.value) : null; } catch { /* ignore */ }
  return NextResponse.json({ total, byExchange, status });
}
