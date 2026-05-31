import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await prisma.sipTransaction.findMany({ where: { sipId: Number(id) }, orderBy: { transactionDate: "asc" } });
  return NextResponse.json(rows.map(r => ({
    id: r.id, transaction_date: r.transactionDate.toISOString().slice(0, 10),
    amount: r.amount, units: r.units, nav: r.nav,
  })));
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const row = await prisma.sipTransaction.create({
    data: { sipId: Number(id), transactionDate: new Date(b.transaction_date), amount: Number(b.amount), units: Number(b.units), nav: Number(b.nav) },
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
