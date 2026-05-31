import { NextResponse } from "next/server";
import { getLoginUrl } from "@/lib/broker-icici";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

// Save API key + secret (so the callback + future logins can use them), and
// return the ICICI login URL. The redirect itself is whatever is registered in
// the ICICI developer portal (must be set to /api/broker/icici/oauth-callback).
export async function POST(req: Request) {
  const { apiKey, apiSecret } = await req.json();
  if (!apiKey || !apiSecret) return NextResponse.json({ error: "apiKey and apiSecret required" }, { status: 400 });
  await prisma.setting.upsert({ where: { key: "icici_api_key" }, create: { key: "icici_api_key", value: apiKey }, update: { value: apiKey } });
  await prisma.setting.upsert({ where: { key: "icici_secret" }, create: { key: "icici_secret", value: apiSecret }, update: { value: apiSecret } });
  const base = new URL(req.url).origin;
  return NextResponse.json({ loginUrl: getLoginUrl(apiKey), callbackUrl: `${base}/api/broker/icici/oauth-callback` });
}
