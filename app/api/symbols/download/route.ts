import { NextResponse } from "next/server";
import { downloadAll } from "@/lib/symbols";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  let exchanges = ["NSE", "NFO", "BSE", "MCX", "MF"];
  try { const body = await req.json(); if (Array.isArray(body.exchanges)) exchanges = body.exchanges; } catch { /* default */ }
  const result = await downloadAll(exchanges);
  return NextResponse.json({ message: "Download complete", result });
}
