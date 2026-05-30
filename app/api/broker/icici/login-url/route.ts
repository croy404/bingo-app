import { NextResponse } from "next/server";
import { getLoginUrl } from "@/lib/broker-icici";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const apiKey = new URL(req.url).searchParams.get("apiKey") ?? "";
  if (!apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });
  return NextResponse.json({ loginUrl: getLoginUrl(apiKey) });
}
