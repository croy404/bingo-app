import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { xirrNewton } from "@/lib/market-data";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ltp = Number(new URL(req.url).searchParams.get("ltp") ?? 0);
  const txs = await prisma.sipTransaction.findMany({ where: { sipId: Number(id) }, orderBy: { transactionDate: "asc" } });
  if (!txs.length) return NextResponse.json({ xirr: null, invested: 0, units: 0, currentValue: 0 });
  const invested = txs.reduce((s, t) => s + t.amount, 0);
  const units = txs.reduce((s, t) => s + t.units, 0);
  const lastNav = ltp > 0 ? ltp : txs[txs.length - 1].nav;
  const currentValue = units * lastNav;
  const flows = txs.map(t => ({ amount: -t.amount, date: t.transactionDate }));
  if (currentValue > 0) flows.push({ amount: currentValue, date: new Date() });
  const x = xirrNewton(flows);
  return NextResponse.json({
    xirr: x ? +(x * 100).toFixed(2) : null,
    invested: +invested.toFixed(2), units: +units.toFixed(4),
    currentValue: +currentValue.toFixed(2), lastNav,
  });
}
