import { NextResponse } from "next/server";
import { getSession } from "@/lib/broker-icici";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSession();
  return NextResponse.json(s ? { connected: true, userName: s.userName, iciUserId: s.iciUserId } : { connected: false });
}
