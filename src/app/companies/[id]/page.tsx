"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Send, Loader2, CheckCircle2, XCircle, Search, FileText, Newspaper, UserRound, Target, Mail, Building2, ShieldCheck } from "lucide-react";
import { api, fmtDate, getPasscode, setPasscode } from "@/lib/client";
import { StatusBadge, StepTrack, statesFromStatus, Skeleton, ErrorBox } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Company = Record<string, any>;
type Ev = { id: number; step: string; level: string; message: string; created_at: string };

function Section({ n, title, icon, children, right }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-700">{n}</span>
          <span className="text-slate-400">{icon}</span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const host = (u: string) => {
  try {
    const x = new URL(u);
    return x.hostname.replace(/^www\./, "") + (x.pathname.length > 1 ? x.pathname.slice(0, 40) : "");
  } catch {
    return u;
  }
};
const Src = ({ url }: { url?: string | null }) =>
  url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-[11px] text-indigo-600 hover:underline">
      <ExternalLink size={10} className="shrink-0" />
      <span className="truncate">{host(url)}</span>
    </a>
  ) : null;

export default function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Company | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [pass, setPass] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<{ company: Company; events: Ev[] }>(`/api/companies/${id}`);
      setC(d.company);
      setEvents(d.events);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage / fetch once on mount
    setPass(getPasscode());
    load();
  }, [load]);

  async function send() {
    setSending(true);
    setSendMsg("");
    try {
      setPasscode(pass);
      const r = await api<{ transport: string }>("/api/send", { method: "POST", json: { companyId: id, passcode: pass } });
      setSendMsg(`Sent via ${r.transport} to your inbox.`);
      load();
    } catch (e) {
      setSendMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  if (err) return <ErrorBox msg={err} />;
  if (!c)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );

  const f = c.facts ?? {};
  const q = c.qualification;
  const contact = c.contact;
  const pains = c.pains;
  const email = c.email;
  const chosen = contact?.chosen;

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/companies" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} /> Prospects
      </Link>

      {/* header */}
      <div className="card mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{c.name || c.domain}</h1>
              <StatusBadge status={c.status} />
            </div>
            <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
              {c.domain}
            </a>
            {f.one_liner && <p className="mt-2 max-w-2xl text-sm text-slate-600">{f.one_liner}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {f.funding_stage && <span>💰 {f.funding_stage}</span>}
              {f.employees_estimate && <span>👥 ~{f.employees_estimate} staff</span>}
              {f.hq && <span>📍 {f.hq}</span>}
              <span>Researched {fmtDate(c.created_at)}</span>
            </div>
          </div>
          {q && (
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-line px-4 py-3">
              <div className={`text-3xl font-bold tabular-nums ${q.decision === "qualified" ? "text-emerald-600" : "text-slate-500"}`}>{q.total}</div>
              <div className="text-xs leading-tight text-muted">
                ICP score / 100
                <br />
                pass ≥ {q.pass_score}
                <br />
                <span className={`font-semibold ${q.decision === "qualified" ? "text-emerald-700" : "text-slate-600"}`}>{q.decision === "qualified" ? "Qualified" : "Not a fit"}</span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 overflow-x-auto border-t border-line pt-4">
          <StepTrack states={statesFromStatus(c.status, c.current_step, c.decision)} />
        </div>
        {c.error && (
          <div className="mt-3">
            <ErrorBox msg={c.error} />
          </div>
        )}
      </div>

      {/* why-cards */}
      {q && (
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="card border-l-4 border-l-emerald-500 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Why this company</div>
            <p className="mt-1.5 text-sm text-slate-700">{q.summary}</p>
          </div>
          <div className="card border-l-4 border-l-indigo-500 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Why this person</div>
            <p className="mt-1.5 text-sm text-slate-700">{chosen ? `${chosen.firstName} ${chosen.lastName} (${chosen.title}): ${contact.reason}.` : contact?.status === "NO_SUITABLE_CONTACT" ? "No one in a compliance-buying role was found, so no email was written." : "Not reached - company did not qualify."}</p>
          </div>
          <div className="card border-l-4 border-l-amber-500 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Why this email</div>
            <p className="mt-1.5 text-sm text-slate-700">{email?.hook?.why ?? "Not reached."}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-5 lg:col-span-3">
          {/* 1 scrape */}
          <Section n={1} title="Scrape - what was read" icon={<FileText size={15} />} right={c.scrape && <span className="text-xs text-muted">{c.scrape.pages_used}/{c.scrape.page_budget} page budget</span>}>
            {!c.scrape?.docs?.length ? (
              <p className="text-sm text-muted">No pages read.</p>
            ) : (
              <ul className="divide-y divide-line">
                {c.scrape.docs.map((d: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {d.kind === "news" || d.kind === "search" ? <Newspaper size={14} className="shrink-0 text-amber-500" /> : <FileText size={14} className="shrink-0 text-slate-400" />}
                      <div className="min-w-0">
                        <Src url={d.url} />
                        {d.title && <div className="truncate text-xs text-slate-600">{d.title}</div>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-muted">
                      {d.rawChars ? `${Math.round(d.rawChars / 1000)}k raw → ` : ""}
                      {Math.round(d.chars / 100) / 10}k clean
                      <div>{d.via === "fetch" ? "plain request" : d.via === "exa" ? "reader fallback" : `search${d.publishedDate ? ` · ${d.publishedDate.slice(0, 10)}` : ""}`}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 2 facts */}
          <Section n={2} title="Extract - structured facts" icon={<Building2 size={15} />}>
            {!c.facts ? (
              <p className="text-sm text-muted">Not reached.</p>
            ) : (
              <>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {[
                    ["Product", f.product],
                    ["Customers", f.target_customers],
                    ["SaaS", f.is_saas == null ? "unknown" : f.is_saas ? "Yes" : "No"],
                    ["Certifications", (f.certifications ?? []).map((x: any) => `${x.name} (${x.status})`).join(", ") || "none found"],
                    ["Enterprise signals", (f.enterprise_signals ?? []).join("; ") || "-"],
                    ["Compliance signals", (f.compliance_signals ?? []).join("; ") || "-"],
                    ["Data handled", (f.data_handled ?? []).join(", ") || "-"],
                    ["Hiring", (f.hiring_signals ?? []).join("; ") || "-"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{k}</dt>
                      <dd className="text-slate-700">{v || "-"}</dd>
                    </div>
                  ))}
                </dl>
                {f.evidence?.length > 0 && (
                  <details className="mt-4 rounded-lg border border-line">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600">Evidence ({f.evidence.length} cited facts)</summary>
                    <ul className="divide-y divide-line border-t border-line">
                      {f.evidence.map((e: any, i: number) => (
                        <li key={i} className="px-3 py-2 text-xs">
                          <div className="font-medium text-slate-700">
                            {e.label}: <span className="font-normal">{e.value}</span>
                          </div>
                          {e.excerpt && <div className="mt-0.5 italic text-muted">“{e.excerpt}”</div>}
                          <Src url={e.source_url} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </Section>

          {/* 3 qualify */}
          <Section n={3} title="Qualify - ICP rubric + agent loop" icon={<Target size={15} />} right={q && <span className="text-xs text-muted">rubric v{q.rubric_version}</span>}>
            {!q ? (
              <p className="text-sm text-muted">Not reached.</p>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  {q.breakdown.map((b: any) => (
                    <div key={b.key}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{b.label}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          {b.score}/10 × {b.weight}% = <b className="text-ink">{b.points}</b>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div className={`h-1.5 rounded-full ${b.score >= 7 ? "bg-emerald-500" : b.score >= 4 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${b.score * 10}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {b.evidence} <span className={`ml-1 rounded px-1 text-[10px] ${b.confidence === "high" ? "bg-emerald-50 text-emerald-700" : b.confidence === "medium" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{b.confidence} confidence</span>
                      </div>
                      <Src url={b.source_url} />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-600">Hard gates (code)</div>
                  <div className="flex flex-wrap gap-2">
                    {q.gates.map((g: any) => (
                      <span key={g.gate} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${g.pass ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                        {g.pass ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {g.gate}
                        <span className="opacity-60">· {g.detail}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-600">Agent loop ({q.rounds.length} round{q.rounds.length > 1 ? "s" : ""})</div>
                  <ol className="relative space-y-3 border-l border-line pl-4">
                    {q.rounds.map((r: any) => (
                      <li key={r.round} className="text-xs">
                        <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        <div className="font-medium text-slate-700">
                          Round {r.round}: score {r.scores.total}/100
                        </div>
                        {r.action.type === "none" ? (
                          <div className="text-muted">Evidence sufficient → decided.</div>
                        ) : (
                          <div className="text-slate-600">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Search size={11} /> {r.action.type.replace("_", " ")}
                            </span>{" "}
                            “{r.action.target}” - {r.action.reason}
                            {r.forced && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">code check</span>}
                            {r.result && <div className="text-muted">→ {r.result}</div>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </Section>

          {/* 4 contact */}
          <Section n={4} title="Point of contact (Lusha)" icon={<UserRound size={15} />} right={contact && <span className="text-xs text-muted">{contact.cached ? "cached" : `${contact.credits ?? 0} credit`}</span>}>
            {!contact ? (
              <p className="text-sm text-muted">Not reached.</p>
            ) : contact.status === "NO_SUITABLE_CONTACT" ? (
              <p className="text-sm text-orange-700">NO_SUITABLE_CONTACT - {contact.candidates?.length ?? 0} people returned, none in a compliance-buying role.</p>
            ) : (
              <div>
                <div className="flex items-center gap-3 rounded-lg bg-indigo-50/60 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {chosen.firstName[0]}
                    {chosen.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">
                      {chosen.firstName} {chosen.lastName}
                    </div>
                    <div className="text-xs text-slate-600">{chosen.title}{chosen.location ? ` · ${chosen.location}` : ""}</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  <b>Rule:</b> {contact.ladder} ladder → {contact.reason}. {contact.candidates_total} people found in role-relevant titles.
                </p>
                {contact.alternatives?.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Ranked lower</div>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {contact.alternatives.map((a: any) => (
                        <li key={a.name}>
                          {a.name} - {a.title} <span className="text-muted">(rank {a.score})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* 5 pains */}
          <Section n={5} title="Two most likely pain points" icon={<ShieldCheck size={15} />}>
            {!pains ? (
              <p className="text-sm text-muted">Not reached.</p>
            ) : (
              <div className="space-y-3">
                {pains.chosen.map((p: any, i: number) => (
                  <div key={i} className="rounded-lg border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{p.title}</div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${p.confidence >= pains.min_confidence ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.confidence}/10</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{p.hypothesis}</p>
                    <p className="mt-1 text-xs text-muted">
                      <b>Why this person:</b> {p.why_this_person}
                    </p>
                    <div className="mt-1.5 space-y-0.5">
                      {p.evidence?.map((e: any, j: number) => (
                        <div key={j} className="text-[11px] text-slate-500">
                          • {e.fact} <Src url={e.source_url} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {pains.rejected?.length > 0 && (
                  <div className="text-xs text-muted">
                    Not chosen: {pains.rejected.map((p: any) => `${p.title} (${p.confidence}/10)`).join(" · ")}
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* right column: email + log */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-5">
            <Section n={6} title="Email" icon={<Mail size={15} />} right={email && <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${email.qa_passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>QA {email.qa?.find((x: any) => x.version === email.chosen_version)?.score ?? email.qa?.at(-1)?.score}/10</span>}>
              {!email?.body ? (
                <p className="text-sm text-muted">Not reached.</p>
              ) : (
                <div>
                  <div className="rounded-lg border border-line">
                    <div className="space-y-0.5 border-b border-line bg-slate-50 px-3 py-2 text-xs">
                      <div>
                        <span className="text-muted">To:</span> {email.to} <span className="text-muted">(test inbox)</span>
                      </div>
                      <div>
                        <span className="text-muted">Intended:</span> {email.intended}
                      </div>
                      <div className="font-semibold text-ink">{email.subject}</div>
                    </div>
                    <div className="whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-slate-800">{email.body}</div>
                  </div>
                  <div className="mt-3 rounded-lg bg-amber-50/70 p-3 text-xs text-slate-700">
                    <b>Hook:</b> {email.hook?.text} <Src url={email.hook?.source_url} />
                  </div>
                  <details className="mt-3 rounded-lg border border-line">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600">
                      QA history - {email.qa?.length} version(s), v{email.chosen_version ?? email.qa?.length} chosen · {email.words} words
                    </summary>
                    <ul className="divide-y divide-line border-t border-line">
                      {email.qa?.map((x: any) => (
                        <li key={x.version} className="px-3 py-2 text-xs">
                          <div className="font-medium">
                            v{x.version} · {x.score}/10 · {x.words} words {x.subject && <span className="font-normal text-muted">“{x.subject}”</span>}
                          </div>
                          {x.issues?.length > 0 && <div className="text-muted">{x.issues.join("; ")}</div>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
            </Section>

            <Section n={7} title="Send" icon={<Send size={15} />}>
              {c.status === "sent" ? (
                <p className="text-sm text-emerald-700">
                  <CheckCircle2 size={14} className="mr-1 inline" />
                  Sent {c.sent_at ? fmtDate(c.sent_at) : ""} to the owner&apos;s inbox only.
                </p>
              ) : email?.body ? (
                <p className="text-sm text-slate-600">{email.qa_passed ? "Ready - auto-send was off for this run." : "Held: QA scored below the bar. Review and send manually if it reads well."}</p>
              ) : (
                <p className="text-sm text-muted">Not reached.</p>
              )}
              {email?.body && (
                <div className="mt-3 flex gap-2">
                  <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Passcode" className="w-32 rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-indigo-400" />
                  <button onClick={send} disabled={sending} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {c.status === "sent" ? "Send again" : "Send to my inbox"}
                  </button>
                </div>
              )}
              {sendMsg && <p className="mt-2 text-xs text-slate-600">{sendMsg}</p>}
            </Section>

            <details className="card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Run log ({events.length})</summary>
              <div className="max-h-80 overflow-y-auto scroll-thin border-t border-line bg-slate-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
                {events.map((e) => (
                  <div key={e.id} className={e.level === "error" ? "text-rose-400" : e.level === "decision" ? "text-emerald-300" : ""}>
                    <span className="text-slate-500">[{e.step}]</span> {e.message}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
