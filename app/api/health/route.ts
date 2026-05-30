import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
export const dynamic = "force-dynamic";

export async function GET() {
  const health: Record<string, string> = { status: "ok", time: new Date().toISOString() };
  try { await prisma.$queryRaw`SELECT 1`; health.postgres = "connected"; }
  catch { health.postgres = "down"; health.status = "degraded"; }
  try { await redis.ping(); health.redis = "connected"; }
  catch { health.redis = "down"; health.status = "degraded"; }
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503 });
}
