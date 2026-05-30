import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 120;
export async function GET() {
  try {
    const res = await fetch("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050", {
      headers: { "User-Agent":"Mozilla/5.0","Referer":"https://www.nseindia.com/" },
      next: { revalidate: 120 },
    });
    const raw = (await res.json()).data ?? [];
    const adv = raw.filter((d: { pChange: number }) => d.pChange > 0.05).length;
    const dec = raw.filter((d: { pChange: number }) => d.pChange < -0.05).length;
    return NextResponse.json({ advances: adv, declines: dec, unchanged: raw.length-adv-dec, total: raw.length });
  } catch { return NextResponse.json({ advances: 0, declines: 0, unchanged: 0, total: 0 }); }
}
