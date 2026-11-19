import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadRubric } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await db()
    .from("sprinto_companies")
    .select("id, run_id, domain, name, status, current_step, score, decision, contact, email, sent_at, error, created_at, facts, sprinto_runs(rubric_version)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rubric = await loadRubric();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined row
  const companies = (data ?? []).map((c: any) => ({
    rubric_version: c.sprinto_runs?.rubric_version ?? null,
    id: c.id, run_id: c.run_id, domain: c.domain, name: c.name, status: c.status, current_step: c.current_step,
    score: c.score, decision: c.decision, sent_at: c.sent_at, error: c.error, created_at: c.created_at,
    one_liner: c.facts?.one_liner ?? null, funding: c.facts?.funding_stage ?? null, employees: c.facts?.employees_estimate ?? null,
    contact: c.contact?.chosen ? { name: `${c.contact.chosen.firstName} ${c.contact.chosen.lastName}`, title: c.contact.chosen.title } : null,
    subject: c.email?.subject ?? null, qa: c.email?.qa?.at?.(-1)?.score ?? null,
  }));
  return NextResponse.json({ companies, active_version: rubric.version });
}
