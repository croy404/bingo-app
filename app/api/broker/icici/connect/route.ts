import { NextResponse } from "next/server";
import { generateSession } from "@/lib/broker-icici";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { apiKey, apiSecret, sessionToken } = await req.json();
  if (!apiKey || !apiSecret || !sessionToken) {
    return NextResponse.json({ error: "apiKey, apiSecret, sessionToken required" }, { status: 400 });
  }
  try {
    const s = await generateSession(apiKey, apiSecret, sessionToken);
    return NextResponse.json({ success: true, userName: s.userName });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 401 });
  }
}
