import { NextResponse } from "next/server";
import { getSession } from "@/lib/broker-fyers";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSession();
  return NextResponse.json(s ? { connected: true, uid: s.uid } : { connected: false });
}
