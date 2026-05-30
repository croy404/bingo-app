import { NextResponse } from "next/server";
import { clearSession } from "@/lib/broker-icici";
export const dynamic = "force-dynamic";
export async function POST() { await clearSession(); return NextResponse.json({ success: true }); }
