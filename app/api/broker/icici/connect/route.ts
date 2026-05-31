import { NextResponse } from "next/server";
import { generateSession } from "@/lib/broker-icici";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { apiKey, apiSecret, sessionToken } = await req.json();
  if (!apiKey || !apiSecret || !sessionToken) {
    return NextResponse.json({ error: "apiKey, apiSecret, sessionToken required" }, { status: 400 });
  }
  try {
    const s = await generateSession(apiKey, apiSecret, sessionToken);
    // Persist creds so the user never re-enters them (single-user app).
    await prisma.setting.upsert({ where: { key: "icici_api_key" }, create: { key: "icici_api_key", value: apiKey }, update: { value: apiKey } });
    await prisma.setting.upsert({ where: { key: "icici_secret" }, create: { key: "icici_secret", value: apiSecret }, update: { value: apiSecret } });
    return NextResponse.json({ success: true, userName: s.userName });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 401 });
  }
}
