import { NextResponse } from "next/server";
import { oauthUrl } from "@/lib/broker-fyers";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { appId, secret } = await req.json();
  if (!appId || !secret) return NextResponse.json({ error: "appId and secret required" }, { status: 400 });
  // Stash pending creds in settings (single-user)
  await supabase.from("settings").upsert([
    { key: "fyers_pending_appid", value: appId },
    { key: "fyers_pending_secret", value: secret },
  ]);
  const base = new URL(req.url).origin;
  const redirect = `${base}/api/broker/fyers/callback`;
  return NextResponse.json({ loginUrl: oauthUrl(appId, redirect) });
}
