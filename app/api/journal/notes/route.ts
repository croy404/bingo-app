import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  const row = await prisma.journalNote.findUnique({ where: { noteDate: new Date(date) } });
  return NextResponse.json({ note_date: date, content: row?.content ?? "" });
}
export async function PUT(req: Request) {
  const { date, content } = await req.json();
  await prisma.journalNote.upsert({
    where: { noteDate: new Date(date) },
    create: { noteDate: new Date(date), content },
    update: { content, updatedAt: new Date() },
  });
  return NextResponse.json({ note_date: date, content });
}
