import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [{ data: company, error }, { data: events }] = await Promise.all([
    db().from("sprinto_companies").select("*").eq("id", id).maybeSingle(),
    db().from("sprinto_events").select("id, step, level, message, created_at").eq("company_id", id).order("id"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ company, events: events ?? [] });
}
