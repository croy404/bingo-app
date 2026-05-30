import { NextResponse } from "next/server";
import { marketStatus } from "@/lib/market-data";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(marketStatus()); }
