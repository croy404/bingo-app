import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await prisma.alert.findMany({ orderBy: { createdAt: "desc" } }));
}
export async function POST(req: Request) {
  const b = await req.json();
  const row = await prisma.alert.create({
    data: {
      symbol: b.symbol.toUpperCase(), exchange: b.exchange ?? "NSE",
      condition: b.condition, price: Number(b.price),
      alertType: b.alert_type ?? "once", cooldownMins: Number(b.cooldown_mins ?? 5),
      remarks: b.remarks ?? "", tag: b.tag ?? "",
    },
  });
  return NextResponse.json(row, { status: 201 });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.alert.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "Deleted" });
}
export async function PATCH(req: Request) {
  const { id } = await req.json();
  const a = await prisma.alert.findUnique({ where: { id: Number(id) } });
  await prisma.alert.update({ where: { id: Number(id) }, data: { isActive: !a?.isActive } });
  return NextResponse.json({ message: "Toggled" });
}
