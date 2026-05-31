import { NextResponse } from "next/server";
import { oauthUrl } from "@/lib/broker-fyers";
import { appBaseUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { appId, secret } = await req.json();
  if (!appId || !secret) return NextResponse.json({ error: "appId and secret required" }, { status: 400 });
  await prisma.setting.upsert({ where: { key: "fyers_pending_appid" }, create: { key: "fyers_pending_appid", value: appId }, update: { value: appId } });
  await prisma.setting.upsert({ where: { key: "fyers_pending_secret" }, create: { key: "fyers_pending_secret", value: secret }, update: { value: secret } });
  const redirectUri = `${appBaseUrl(req)}/api/broker/fyers/callback`;
  return NextResponse.json({ loginUrl: oauthUrl(appId, redirectUri), redirectUri });
}
