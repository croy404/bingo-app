import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  const { data } = await supabase.from("journal_notes").select("*").eq("note_date", date).single();
  return NextResponse.json(data ?? { note_date: date, content: "" });
}
export async function PUT(req: Request) {
  const { date, content } = await req.json();
  await supabase.from("journal_notes").upsert({ note_date: date, content });
  return NextResponse.json({ note_date: date, content });
}
