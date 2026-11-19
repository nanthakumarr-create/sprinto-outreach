"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { api, getPasscode, setPasscode } from "@/lib/client";
import { PageHeader, Skeleton, ErrorBox } from "@/components/ui";

type Criterion = { key: string; label: string; weight: number; guide: string };
type Rubric = {
  version: number;
  pass_score: number;
  criteria: Criterion[];
  max_employees: number;
  competitors: string[];
  max_rounds: number;
  page_budget: number;
  pain_min_confidence: number;
  email: { min_words: number; max_words: number; qa_pass: number; max_revisions: number };
};

export default function RubricPage() {
  const [r, setR] = useState<Rubric | null>(null);
  const [transport, setTransport] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [pass, setPass] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage / fetch once on mount
    setPass(getPasscode());
    api<{ rubric: Rubric; transport: string }>("/api/rubric")
      .then((d) => {
        setR(d.rubric);
        setTransport(d.transport);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const total = r?.criteria.reduce((a, c) => a + Number(c.weight), 0) ?? 0;

  async function save() {
    if (!r) return;
    setSaving(true);
    setMsg("");
    try {
      setPasscode(pass);
      const d = await api<{ rubric: Rubric }>("/api/rubric", { method: "PUT", json: { rubric: r, passcode: pass } });
      setR(d.rubric);
      setMsg(`Saved as v${d.rubric.version}. New runs use it.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="ICP rubric" sub="Sprinto's ideal customer, as the pipeline scores it. Stored in Supabase and versioned, so it can be tuned without a deploy." />
      {err && <ErrorBox msg={err} />}
      {!r ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Definition we arrived at</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              A <b>B2B SaaS</b> company at <b>Series A-C (≈20-1000 staff)</b> that <b>sells to mid-market or enterprise buyers</b> and therefore faces
              security reviews, shows a <b>compliance trigger</b> (fresh funding, SOC 2 in progress, a trust page with framework gaps, security hiring,
              regulated customers, EU/US expansion) and <b>handles sensitive customer data</b>. Compliance-automation vendors and large enterprises with
              mature GRC teams are excluded by hard gates.
            </p>
          </div>

          <div className="card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Weighted criteria (AI scores 0-10, code multiplies)</h2>
              <span className={`text-xs font-semibold ${total === 100 ? "text-emerald-700" : "text-rose-600"}`}>Σ weights = {total}</span>
            </div>
            <div className="divide-y divide-line">
              {r.criteria.map((c, i) => (
                <div key={c.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_90px]">
                  <div>
                    <div className="text-sm font-medium">{c.label}</div>
                    <div className="mt-0.5 text-xs text-muted">{c.guide}</div>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-muted sm:justify-end">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={c.weight}
                      onChange={(e) => {
                        const crit = [...r.criteria];
                        crit[i] = { ...c, weight: Number(e.target.value) };
                        setR({ ...r, criteria: crit });
                      }}
                      className="w-16 rounded-md border border-line px-2 py-1 text-right text-sm text-ink outline-none focus:border-indigo-400"
                    />
                    %
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="card p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-semibold">Thresholds</h2>
              {(
                [
                  ["Pass score (/100)", "pass_score"],
                  ["Max agent-loop rounds", "max_rounds"],
                  ["Page budget per company", "page_budget"],
                  ["Max employees (gate)", "max_employees"],
                  ["Min pain confidence (/10)", "pain_min_confidence"],
                ] as const
              ).map(([label, k]) => (
                <label key={k} className="flex items-center justify-between py-1.5 text-sm">
                  {label}
                  <input type="number" value={r[k]} onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })} className="w-24 rounded-md border border-line px-2 py-1 text-right outline-none focus:border-indigo-400" />
                </label>
              ))}
              {(
                [
                  ["Email min words", "min_words"],
                  ["Email max words", "max_words"],
                  ["Email QA pass (/10)", "qa_pass"],
                  ["Max rewrites", "max_revisions"],
                ] as const
              ).map(([label, k]) => (
                <label key={k} className="flex items-center justify-between py-1.5 text-sm">
                  {label}
                  <input type="number" value={r.email[k]} onChange={(e) => setR({ ...r, email: { ...r.email, [k]: Number(e.target.value) } })} className="w-24 rounded-md border border-line px-2 py-1 text-right outline-none focus:border-indigo-400" />
                </label>
              ))}
            </div>
            <div className="card p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-semibold">Hard gates (applied in code, not AI)</h2>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li>• Must be B2B SaaS / software</li>
                <li>• Must not be a compliance-automation vendor (competitor)</li>
                <li>• Must have ≤ {r.max_employees.toLocaleString()} employees</li>
              </ul>
              <div className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted">Competitor list</div>
              <textarea
                value={r.competitors.join(", ")}
                onChange={(e) => setR({ ...r, competitors: e.target.value.split(/[\s,]+/).filter(Boolean) })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-line px-2.5 py-2 font-mono text-xs outline-none focus:border-indigo-400"
              />
              <div className="mt-3 text-xs text-muted">
                Mail transport: <b>{transport === "gmail" ? "Gmail (SMTP)" : transport === "resend" ? "Resend (fallback)" : "not configured"}</b>
              </div>
            </div>
          </div>

          <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted">Active version: v{r.version}</span>
            <div className="flex gap-2">
              <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Passcode" className="w-32 rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-indigo-400" />
              <button onClick={save} disabled={saving || total !== 100} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save new version
              </button>
            </div>
          </div>
          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
