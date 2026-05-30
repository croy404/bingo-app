import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { symbolCount } from "@/lib/symbols";
export const dynamic = "force-dynamic";

export async function GET() {
  const total = await symbolCount();
  const byExchange: Record<string, number> = {};
  for (const ex of ["NSE", "NFO", "BSE", "MCX", "AMFI"]) {
    byExchange[ex] = await prisma.symbol.count({ where: { exchange: ex } });
  }
  return NextResponse.json({ total, byExchange });
}
