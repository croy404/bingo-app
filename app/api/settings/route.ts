import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
const SECRETS = ["tg_token", "tg_token2", "wa_apikey", "icici_secret", "fyers_secret"];

export async function GET() {
  const rows = await prisma.setting.findMany();
  const d: Record<string, string> = {};
  for (const r of rows) d[r.key] = SECRETS.includes(r.key) && r.value ? "***saved***" : (r.value ?? "");
  return NextResponse.json(d);
}
export async function POST(req: Request) {
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    if (value && value !== "***saved***") {
      await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value), updatedAt: new Date() } });
    }
  }
  return NextResponse.json({ message: "Saved" });
}
