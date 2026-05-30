import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
const SECRETS = ["tg_token","tg_token2","wa_apikey","icici_secret","fyers_secret"];
export async function GET() {
  const { data } = await supabase.from("settings").select("key,value");
  const d: Record<string, string> = {};
  for (const r of data ?? []) d[r.key] = SECRETS.includes(r.key) ? "***saved***" : r.value;
  return NextResponse.json(d);
}
export async function POST(req: Request) {
  const body = await req.json();
  for (const [k, v] of Object.entries(body)) {
    if (v && v !== "***saved***") {
      await supabase.from("settings").upsert({ key: k, value: String(v) });
    }
  }
  return NextResponse.json({ message: "Saved" });
}
