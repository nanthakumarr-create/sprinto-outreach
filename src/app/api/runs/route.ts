import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPasscode } from "@/lib/auth";
import { normalizeDomain } from "@/lib/scrape";
import { loadRubric } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await db()
    .from("sprinto_runs")
    .select("id, created_at, domains, auto_send, status, rubric_version, sprinto_companies(id, domain, name, status, score, decision)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkPasscode(req, body)) return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  const raw: string[] = Array.isArray(body.domains) ? body.domains : String(body.domains ?? "").split(/[\s,;]+/);
  const domains = [...new Set(raw.map(normalizeDomain).filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)))].slice(0, 10);
  if (!domains.length) return NextResponse.json({ error: "Enter at least one valid domain (e.g. acme.com)" }, { status: 400 });
  const rubric = await loadRubric();
  const { data: run, error } = await db()
    .from("sprinto_runs")
    .insert({ domains, auto_send: body.autoSend !== false, rubric_version: rubric.version })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: companies, error: e2 } = await db()
    .from("sprinto_companies")
    .insert(domains.map((domain) => ({ run_id: run.id, domain })))
    .select("id, domain");
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ run, companies });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkPasscode(req, body)) return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  await db().from("sprinto_runs").update({ status: body.status ?? "done" }).eq("id", body.runId);
  return NextResponse.json({ ok: true });
}
