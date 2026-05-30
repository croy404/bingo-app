import { NextResponse } from "next/server";
import { getAIStatus } from "@/lib/ai-provider";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ providers: getAIStatus(), available: getAIStatus().some(p => p.configured) }); }
