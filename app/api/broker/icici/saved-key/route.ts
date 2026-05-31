import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
// Returns the saved ICICI API key (NOT the secret) so the UI can pre-fill.
export async function GET() {
  const row = await prisma.setting.findUnique({ where: { key: "icici_api_key" } });
  const sec = await prisma.setting.findUnique({ where: { key: "icici_secret" } });
  return NextResponse.json({ apiKey: row?.value ?? null, hasSecret: !!sec?.value });
}
