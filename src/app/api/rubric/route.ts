import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPasscode } from "@/lib/auth";
import { loadRubric, Rubric } from "@/lib/rubric";
import { mailTransport } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function GET() {
  const rubric = await loadRubric();
  return NextResponse.json({ rubric, transport: mailTransport() });
}

/** Saves a new rubric version (old versions are kept, inactive). */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkPasscode(req, body)) return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  const current = await loadRubric();
  const next: Rubric = { ...current, ...body.rubric, version: current.version + 1 };
  const total = next.criteria.reduce((a, c) => a + Number(c.weight), 0);
  if (total !== 100) return NextResponse.json({ error: `Weights must sum to 100 (got ${total})` }, { status: 400 });
  await db().from("sprinto_rubric").update({ active: false }).eq("active", true);
  const { error } = await db().from("sprinto_rubric").insert({ version: next.version, active: true, config: next });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rubric: next });
}
