/**
 * Returns live broker WebSocket stream status.
 * Checks Redis for recently-updated price keys to determine if ticks are flowing.
 */
import { NextResponse } from "next/server";
import { getSession as iciciSession } from "@/lib/broker-icici";
import { getSession as fyersSession } from "@/lib/broker-fyers";
import { cacheGet } from "@/lib/redis";
export const dynamic = "force-dynamic";

export async function GET() {
  const [icici, fyers] = await Promise.all([iciciSession(), fyersSession()]);
  // Probe a well-known symbol to see if ticks are fresh (within last 2 minutes)
  const probe = await cacheGet<{ source?: string; live?: boolean; ts?: number }>("price:NSE:RELIANCE") ??
                await cacheGet<{ source?: string; live?: boolean; ts?: number }>("price:NSE:TCS");
  const lastTickAge = probe ? Date.now() - (probe.ts ?? 0) : null;
  const streaming = lastTickAge !== null && lastTickAge < 120_000;
  const source = probe?.source ?? null;
  return NextResponse.json({
    iciciConnected: !!icici,
    fyersConnected: !!fyers,
    streaming,
    source,
    lastTickAgeSec: lastTickAge !== null ? Math.floor(lastTickAge / 1000) : null,
  });
}
