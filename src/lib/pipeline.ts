import "server-only";
import { db, logEvent, updateCompany } from "./db";
import { geminiJSON, newUsage, Usage } from "./gemini";
import { exaSearch } from "./exa";
import { scrapePage, pickPages, normalizeDomain, PageDoc } from "./scrape";
import { findContacts, rankContacts, LushaContact } from "./lusha";
import { loadRubric, Rubric, SPRINTO_CONTEXT } from "./rubric";
import { sendOutreach, outreachInbox, maskEmail, mailTransport } from "./mailer";

export type PipelineEvent = {
  step: Step;
  status: "start" | "progress" | "done" | "fail" | "skip";
  message: string;
  data?: unknown;
};
export type Step = "scrape" | "extract" | "qualify" | "contact" | "pains" | "draft" | "send";
type Emit = (e: PipelineEvent) => void;

// ---------- types the AI returns ----------
export type Evidence = { label: string; value: string; source_url: string; excerpt: string; date?: string | null };
export type Facts = {
  name: string;
  one_liner: string;
  product: string;
  is_saas: boolean | null;
  target_customers: string;
  employees_estimate: number | null;
  funding_stage: string | null;
  hq: string | null;
  certifications: { name: string; status: "held" | "in_progress" | "mentioned" }[];
  has_trust_page: boolean;
  enterprise_signals: string[];
  compliance_signals: string[];
  data_handled: string[];
  hiring_signals: string[];
  recent_news: { headline: string; date: string | null; url: string }[];
  evidence: Evidence[];
};
type CriterionScore = { score: number; evidence: string; source_url: string | null; confidence: "high" | "medium" | "low" };
type QualifyOut = {
  scores: Record<string, CriterionScore>;
  is_competitor: boolean;
  summary: string;
  next_action: { type: "fetch_page" | "search_news" | "search_web" | "none"; target: string; reason: string };
};
export type Pain = {
  title: string;
  hypothesis: string;
  why_this_person: string;
  evidence: { fact: string; source_url: string }[];
  confidence: number;
};
export type Draft = { subject: string; body: string; hook: { text: string; source_url: string; why: string }; angle: string };
type QA = {
  score: number;
  checks: Record<string, boolean>;
  issues: string[];
  fix_instructions: string;
};

const docBlock = (d: PageDoc, i: number) =>
  `[DOC ${i + 1}] kind=${d.kind} url=${d.url}${d.publishedDate ? ` published=${d.publishedDate.slice(0, 10)}` : ""}\n${d.text}`;

// ---------- Step 2: extraction ----------
async function extract(domain: string, docs: PageDoc[], prev: Facts | null, usage: Usage): Promise<Facts> {
  const system = `You extract structured, evidence-backed company data for a B2B sales research pipeline.
Rules:
- Use ONLY the documents provided. If something is not stated, use null / [] / false. Never guess numbers.
- Every important claim must appear in "evidence" with the exact source_url of the document and a short verbatim excerpt (<=25 words).
- Ignore navigation, cookie, footer and marketing boilerplate.
- Dates: copy the published date if the document has one.
Return JSON only.`;
  const prompt = `Company domain: ${domain}
${prev ? `Current facts (update/merge with any new information, keep existing evidence unless contradicted):\n${JSON.stringify(prev)}\n` : ""}
Documents:
${docs.map(docBlock).join("\n\n")}

Return JSON with exactly these keys:
{"name": string, "one_liner": string, "product": string, "is_saas": boolean|null, "target_customers": string,
 "employees_estimate": number|null, "funding_stage": string|null (e.g. "Series B, $40M, Mar 2026"), "hq": string|null,
 "certifications": [{"name": "SOC 2 Type II", "status": "held"|"in_progress"|"mentioned"}],
 "has_trust_page": boolean, "enterprise_signals": string[], "compliance_signals": string[], "data_handled": string[],
 "hiring_signals": string[], "recent_news": [{"headline": string, "date": string|null, "url": string}],
 "evidence": [{"label": string, "value": string, "source_url": string, "excerpt": string, "date": string|null}]}`;
  return geminiJSON<Facts>({ system, prompt, usage });
}

// ---------- Step 3: qualification (one round of the agent loop) ----------
async function qualifyRound(
  domain: string,
  facts: Facts,
  rubric: Rubric,
  links: { url: string; label: string }[],
  history: string[],
  roundsLeft: number,
  usage: Usage,
): Promise<QualifyOut> {
  const system = `You are the qualification agent for Sprinto's outbound team.
${SPRINTO_CONTEXT}
Score the prospect against each rubric criterion 0-10 using ONLY the facts given. Cite the source_url behind each score.
Set confidence "low" when the facts don't really establish the score.
If evidence that would change the decision is missing, request ONE more piece of information via next_action:
- "fetch_page": target = a URL from the site's link list (e.g. /security, /about, /customers, /careers)
- "search_news": target = a news query (funding round, headcount, SOC 2 announcement, enterprise deals)
- "search_web": target = a general web query
- "none": evidence is sufficient (or ${roundsLeft} rounds left is 0).
Never request LinkedIn. Don't repeat an action already taken. Return JSON only.`;
  const prompt = `Domain: ${domain}
Rubric criteria:
${rubric.criteria.map((c) => `- ${c.key} (weight ${c.weight}): ${c.label}. Guide: ${c.guide}`).join("\n")}
Known competitors (compliance automation vendors - auto disqualify): ${rubric.competitors.join(", ")}

Facts:
${JSON.stringify(facts)}

Site links available to fetch:
${links.slice(0, 60).map((l) => `${l.url} (${l.label})`).join("\n")}

Actions already taken: ${history.length ? history.join(" | ") : "none"}
Rounds left for more research: ${roundsLeft}

Return JSON:
{"scores": {${rubric.criteria.map((c) => `"${c.key}": {"score": 0-10, "evidence": string, "source_url": string|null, "confidence": "high"|"medium"|"low"}`).join(", ")}},
 "is_competitor": boolean, "summary": string (2 sentences: why fit or not),
 "next_action": {"type": "fetch_page"|"search_news"|"search_web"|"none", "target": string, "reason": string}}`;
  return geminiJSON<QualifyOut>({ system, prompt, usage });
}

function computeScore(q: QualifyOut, rubric: Rubric) {
  const breakdown = rubric.criteria.map((c) => {
    const s = q.scores?.[c.key];
    const score = Math.max(0, Math.min(10, Number(s?.score ?? 0)));
    return { key: c.key, label: c.label, weight: c.weight, score, points: Math.round((c.weight * score) / 10 * 10) / 10, evidence: s?.evidence ?? "", source_url: s?.source_url ?? null, confidence: s?.confidence ?? "low" };
  });
  const total = Math.round(breakdown.reduce((a, b) => a + b.points, 0));
  return { breakdown, total };
}

// ---------- main pipeline ----------
export async function runPipeline(companyId: string, emitRaw: Emit) {
  const usage = newUsage();
  const t0 = Date.now();
  const { data: company } = await db().from("sprinto_companies").select("*, sprinto_runs(auto_send)").eq("id", companyId).single();
  if (!company) throw new Error("Company not found");
  const domain = normalizeDomain(company.domain);
  const autoSend: boolean = company.sprinto_runs?.auto_send ?? true;
  const rubric = await loadRubric();

  const emit: Emit = (e) => {
    emitRaw(e);
    logEvent(companyId, e.step, e.message, e.data, e.status === "fail" ? "error" : e.status === "done" ? "decision" : "info").catch(() => {});
  };
  const setStep = (step: Step) => updateCompany(companyId, { status: "running", current_step: step });

  try {
    // ---------------- 1. SCRAPE ----------------
    await setStep("scrape");
    emit({ step: "scrape", status: "start", message: `Fetching https://${domain}` });
    let budget = rubric.page_budget;
    const docs: PageDoc[] = [];
    const visited = new Set<string>();
    const home = await scrapePage(`https://${domain}`, "home");
    budget--;
    if (!home.doc) {
      emit({ step: "scrape", status: "fail", message: `Homepage unreachable: ${home.error}` });
      await updateCompany(companyId, { status: "error", error: `Scrape failed: ${home.error}`, scrape: { docs: [], error: home.error } });
      return;
    }
    docs.push(home.doc);
    visited.add(home.doc.url.replace(/\/$/, ""));
    visited.add(`https://${domain}`);
    const links = home.links;
    const extra = pickPages(links, 3, visited);
    for (const p of extra) {
      if (budget <= 0) break;
      const r = await scrapePage(p.url, "page");
      budget--;
      if (r.doc) docs.push(r.doc);
      emit({ step: "scrape", status: "progress", message: r.doc ? `Read ${p.reason} page: ${p.url}` : `Skipped ${p.url} (${r.error})` });
    }
    const scrapeSummary = () => ({
      docs: docs.map((d) => ({ url: d.url, kind: d.kind, title: d.title, via: d.via, chars: d.chars, rawChars: d.rawChars, publishedDate: d.publishedDate ?? null, preview: d.text.slice(0, 600) })),
      pages_used: rubric.page_budget - budget,
      page_budget: rubric.page_budget,
      links_found: links.length,
    });
    await updateCompany(companyId, { scrape: scrapeSummary() });
    emit({ step: "scrape", status: "done", message: `${docs.length} pages read, cleaned to ${docs.reduce((a, d) => a + d.text.length, 0).toLocaleString()} chars (from ${docs.reduce((a, d) => a + d.rawChars, 0).toLocaleString()} raw)` });

    // ---------------- 2. EXTRACT ----------------
    await setStep("extract");
    emit({ step: "extract", status: "start", message: "Extracting structured company data with Gemini" });
    let facts = await extract(domain, docs, null, usage);
    await updateCompany(companyId, { facts, name: facts.name || domain });
    emit({ step: "extract", status: "done", message: `${facts.name}: ${facts.one_liner}`, data: { evidence: facts.evidence?.length ?? 0 } });

    // ---------------- 3. QUALIFY (agent loop) ----------------
    await setStep("qualify");
    const rounds: { round: number; scores: ReturnType<typeof computeScore>; action: QualifyOut["next_action"]; forced?: boolean; result?: string }[] = [];
    const history: string[] = [];
    let q: QualifyOut | null = null;
    let roundNo = 0;
    while (true) {
      roundNo++;
      const roundsLeft = rubric.max_rounds - (roundNo - 1);
      emit({ step: "qualify", status: "progress", message: `Round ${roundNo}: scoring against ICP rubric v${rubric.version}` });
      q = await qualifyRound(domain, facts, rubric, links, history, Math.max(0, roundsLeft - 1), usage);
      const scored = computeScore(q, rubric);
      let action = q.next_action ?? { type: "none", target: "", reason: "" };
      let forced = false;
      // Code-level sufficiency check: a heavy criterion scored on weak evidence gets one more look even if the model says stop.
      const weak = scored.breakdown.find((b) => b.weight >= 20 && b.confidence === "low");
      if (action.type === "none" && weak && roundNo < rubric.max_rounds && budget > 0 && !history.some((h) => h.startsWith("search_news"))) {
        action = { type: "search_news", target: `${facts.name || domain} ${weak.key === "stage" ? "funding round series employees" : "SOC 2 ISO 27001 security compliance enterprise customers"}`, reason: `Code check: "${weak.label}" was scored on low-confidence evidence` };
        forced = true;
      }
      const round = { round: roundNo, scores: scored, action, forced } as (typeof rounds)[number];
      rounds.push(round);
      if (action.type === "none" || roundNo >= rubric.max_rounds || budget <= 0) {
        if (action.type !== "none") round.result = roundNo >= rubric.max_rounds ? "Round limit reached - decided on available evidence" : "Page budget exhausted";
        break;
      }
      // execute the requested action
      emit({ step: "qualify", status: "progress", message: `Needs more evidence${forced ? " (code check)" : ""}: ${action.type} "${action.target}" - ${action.reason}` });
      history.push(`${action.type}:${action.target}`);
      const newDocs: PageDoc[] = [];
      try {
        if (action.type === "fetch_page") {
          const url = action.target.startsWith("http") ? action.target : `https://${domain}${action.target.startsWith("/") ? "" : "/"}${action.target}`;
          const r = await scrapePage(url, "page");
          budget--;
          if (r.doc) newDocs.push(r.doc);
          round.result = r.doc ? `Fetched ${url}` : `Retrieval failure: ${r.error}`;
        } else {
          const hits = await exaSearch(action.target, { news: action.type === "search_news", num: 4 });
          budget--;
          for (const h of hits) newDocs.push({ url: h.url, kind: action.type === "search_news" ? "news" : "search", title: h.title, text: `${h.title}\n${h.text}`, chars: h.text.length, rawChars: 0, via: "exa-search", publishedDate: h.publishedDate });
          round.result = `${hits.length} results`;
        }
      } catch (e) {
        round.result = `Action failed: ${e instanceof Error ? e.message : e}`;
      }
      if (newDocs.length) {
        docs.push(...newDocs);
        facts = await extract(domain, newDocs, facts, usage);
        await updateCompany(companyId, { facts, scrape: scrapeSummary() });
      }
      emit({ step: "qualify", status: "progress", message: `Round ${roundNo} result: ${round.result}` });
    }
    const final = rounds[rounds.length - 1].scores;
    const gates = [
      { gate: "Is B2B SaaS / software", pass: facts.is_saas !== false, detail: facts.is_saas === false ? "Facts say not SaaS" : "OK" },
      { gate: "Not a compliance-automation competitor", pass: !(q?.is_competitor || rubric.competitors.includes(domain)), detail: rubric.competitors.includes(domain) ? "On competitor list" : q?.is_competitor ? "Model flagged as competitor" : "OK" },
      ...(rubric.min_trigger_score
        ? [(() => {
            const t = final.breakdown.find((b) => b.key === "compliance_trigger");
            const ok = !t || t.score >= rubric.min_trigger_score!;
            return { gate: `Compliance trigger ≥ ${rubric.min_trigger_score}/10`, pass: ok, detail: t ? `scored ${t.score}/10${ok ? "" : " - no reason to buy now"}` : "n/a" };
          })()]
        : []),
      { gate: `Not a large enterprise (≤${rubric.max_employees} staff)`, pass: !(facts.employees_estimate && facts.employees_estimate > rubric.max_employees), detail: facts.employees_estimate ? `~${facts.employees_estimate} staff` : "Headcount unknown" },
    ];
    const gatesPass = gates.every((g) => g.pass);
    const qualified = gatesPass && final.total >= rubric.pass_score;
    const qualification = { rubric_version: rubric.version, pass_score: rubric.pass_score, total: final.total, breakdown: final.breakdown, gates, summary: q?.summary ?? "", rounds, decision: qualified ? "qualified" : "disqualified" };
    await updateCompany(companyId, { qualification, score: final.total, decision: qualification.decision, facts, scrape: scrapeSummary() });
    emit({
      step: "qualify",
      status: "done",
      message: `${qualified ? "QUALIFIED" : "NOT A FIT"} - ${final.total}/100 (pass ≥ ${rubric.pass_score})${gatesPass ? "" : `; failed gate: ${gates.filter((g) => !g.pass).map((g) => g.gate).join(", ")}`} after ${rounds.length} round(s)`,
      data: { total: final.total, qualified },
    });
    if (!qualified) {
      for (const s of ["contact", "pains", "draft", "send"] as Step[]) emit({ step: s, status: "skip", message: "Skipped - company did not qualify" });
      await updateCompany(companyId, { status: "disqualified", current_step: null, email: { usage, ms: Date.now() - t0 } });
      return;
    }

    // ---------------- 4. CONTACT ----------------
    await setStep("contact");
    emit({ step: "contact", status: "start", message: "Searching Lusha for decision-makers" });
    const found = await findContacts(domain);
    const { ranked, ladder } = rankContacts(found.contacts, facts.employees_estimate);
    if (!ranked.length) {
      await updateCompany(companyId, { status: "no_contact", current_step: null, contact: { status: "NO_SUITABLE_CONTACT", candidates: found.contacts, cached: found.cached, credits: found.credits } });
      emit({ step: "contact", status: "fail", message: `NO_SUITABLE_CONTACT - Lusha returned ${found.contacts.length} people, none in a compliance-buying role` });
      for (const s of ["pains", "draft", "send"] as Step[]) emit({ step: s, status: "skip", message: "Skipped - no suitable contact" });
      return;
    }
    const pick = ranked[0];
    const contact = {
      status: "FOUND",
      chosen: pick.contact,
      reason: pick.reason,
      ladder,
      alternatives: ranked.slice(1, 5).map((r) => ({ name: `${r.contact.firstName} ${r.contact.lastName}`, title: r.contact.title, score: r.score, reason: r.reason })),
      candidates_total: found.contacts.length,
      cached: found.cached,
      credits: found.credits,
    };
    await updateCompany(companyId, { contact });
    emit({ step: "contact", status: "done", message: `${pick.contact.firstName} ${pick.contact.lastName}, ${pick.contact.title} - ${pick.reason}${found.cached ? " (cached)" : ""}` });

    // ---------------- 5. PAIN POINTS ----------------
    await setStep("pains");
    emit({ step: "pains", status: "start", message: `Hypothesising pain points for a ${pick.contact.title}` });
    const pp = await geminiJSON<{ pains: Pain[] }>({
      usage,
      system: `You are a B2B sales strategist for Sprinto.\n${SPRINTO_CONTEXT}\nGenerate pain-point hypotheses that are specific to THIS person's role and THIS company's evidence. Each must cite evidence from the facts (with source_url). Rate confidence 1-10 honestly: 8+ only if the evidence directly points to it. Return JSON only.`,
      prompt: `Person: ${pick.contact.firstName} ${pick.contact.lastName}, ${pick.contact.title} at ${facts.name}
Company facts: ${JSON.stringify(facts)}
Qualification notes: ${qualification.summary}
Give 4 candidate pain points, ranked best first.
JSON: {"pains": [{"title": string (<=8 words), "hypothesis": string (1-2 sentences, what hurts and why now), "why_this_person": string, "evidence": [{"fact": string, "source_url": string}], "confidence": 1-10}]}`,
    });
    const allPains = (pp.pains ?? []).sort((a, b) => b.confidence - a.confidence);
    const strong = allPains.filter((p) => p.confidence >= rubric.pain_min_confidence);
    const pains = { chosen: (strong.length >= 2 ? strong : allPains).slice(0, 2), rejected: allPains.slice(2), min_confidence: rubric.pain_min_confidence, below_threshold: strong.length < 2 };
    await updateCompany(companyId, { pains });
    emit({ step: "pains", status: "done", message: pains.chosen.map((p) => `${p.title} (${p.confidence}/10)`).join(" · ") + (pains.below_threshold ? " - flagged: below confidence bar" : "") });

    // ---------------- 6. DRAFT + QA ----------------
    await setStep("draft");
    const sender = process.env.SENDER_NAME || "Sprinto Growth Team";
    const draftSystem = `You write first-touch cold emails for Sprinto that a busy ${pick.contact.title} would actually reply to.
${SPRINTO_CONTEXT}
Rules:
- Address them by first name. ${rubric.email.min_words}-${rubric.email.max_words} words in the body (excluding sign-off).
- Open with ONE specific hook from the evidence (a dated event, a page on their site, a hire, a customer segment) - not flattery, not "I came across your website".
- Connect the hook to the two pain points in their language. One sentence on how Sprinto helps, no feature dump.
- One low-friction CTA (a question or a 15-minute call). No links, no attachments, no fake stats, no made-up customers.
- Plain text, short paragraphs, sign off as "${sender}, Sprinto". Subject: under 7 words, lowercase-ish, specific.
Return JSON only.`;
    const draftPrompt = `Prospect: ${pick.contact.firstName} ${pick.contact.lastName}, ${pick.contact.title} at ${facts.name} (${domain})
Pain points: ${JSON.stringify(pains.chosen)}
Facts: ${JSON.stringify({ ...facts, evidence: facts.evidence?.slice(0, 25) })}
JSON: {"subject": string, "body": string, "hook": {"text": string, "source_url": string, "why": string}, "angle": string}`;
    let draft = await geminiJSON<Draft>({ usage, system: draftSystem, prompt: draftPrompt, temperature: 0.6 });
    const qaHistory: (QA & { words: number; version: number; subject: string })[] = [];
    let best: { draft: Draft; rank: number; idx: number } | null = null;
    for (let v = 0; v <= rubric.email.max_revisions; v++) {
      const words = countWords(draft.body);
      emit({ step: "draft", status: "progress", message: `Draft v${v + 1}: "${draft.subject}" (${words} words) - running QA` });
      const qa = await geminiJSON<QA>({
        usage,
        system: `You are a strict cold-email reviewer. Score 1-10 where 8 = a real ${pick.contact.title} might reply. Penalise generic hooks, invented facts, hype, multiple CTAs, wrong length. Return JSON only.`,
        prompt: `Evidence the writer had: ${JSON.stringify(facts.evidence?.slice(0, 25))}
Pain points: ${JSON.stringify(pains.chosen)}
Email to ${pick.contact.firstName} (${pick.contact.title} at ${facts.name}):
Subject: ${draft.subject}
${draft.body}
Word count (code-measured): ${words}; required ${rubric.email.min_words}-${rubric.email.max_words}.
JSON: {"score": 1-10, "checks": {"addressed_by_name": bool, "specific_hook_from_evidence": bool, "pains_addressed": bool, "single_cta": bool, "no_fabrication": bool, "length_ok": bool}, "issues": string[], "fix_instructions": string}`,
      });
      const lengthOk = words >= rubric.email.min_words - 5 && words <= rubric.email.max_words + 5;
      qaHistory.push({ ...qa, words, version: v + 1, subject: draft.subject });
      const rank = qa.score + (lengthOk ? 10 : 0);
      if (!best || rank > best.rank) best = { draft, rank, idx: qaHistory.length - 1 };
      if ((qa.score >= rubric.email.qa_pass && lengthOk) || v === rubric.email.max_revisions) break;
      emit({ step: "draft", status: "progress", message: `QA ${qa.score}/10${lengthOk ? "" : `, ${words} words`} - revising: ${qa.fix_instructions}` });
      draft = await geminiJSON<Draft>({
        usage,
        system: draftSystem,
        prompt: `${draftPrompt}\n\nPrevious draft:\nSubject: ${draft.subject}\n${draft.body}\n\nReviewer feedback (fix all): ${qa.issues.join("; ")}. ${qa.fix_instructions}${lengthOk ? "" : ` Body is ${words} words - must be ${rubric.email.min_words}-${rubric.email.max_words}.`}`,
        temperature: 0.5,
      });
    }
    draft = best!.draft;
    const lastQA = qaHistory[best!.idx];
    const qaPassed = lastQA.score >= rubric.email.qa_pass && lastQA.words >= rubric.email.min_words - 5 && lastQA.words <= rubric.email.max_words + 5;
    const email = { ...draft, words: lastQA.words, qa: qaHistory, chosen_version: lastQA.version, qa_passed: qaPassed, to: maskEmail(outreachInbox()), intended: `${pick.contact.firstName} ${pick.contact.lastName} <${pick.contact.title}, ${facts.name}>`, usage, ms: Date.now() - t0 };
    await updateCompany(companyId, { email });
    emit({ step: "draft", status: "done", message: `Final: "${draft.subject}" - v${lastQA.version} chosen, QA ${lastQA.score}/10, ${lastQA.words} words (${qaHistory.length} version(s) tried)${qaPassed ? "" : " (below bar - held for review)"}` });

    // ---------------- 7. SEND ----------------
    if (autoSend && qaPassed && mailTransport() === "none") {
      await updateCompany(companyId, { status: "ready", current_step: null });
      emit({ step: "send", status: "skip", message: "No mail transport configured yet - draft saved, send from the dashboard once Gmail is connected" });
      return;
    }
    if (!autoSend || !qaPassed) {
      await updateCompany(companyId, { status: "ready", current_step: null });
      emit({ step: "send", status: "skip", message: !qaPassed ? "Held for human review - QA below bar" : "Auto-send off - ready to send from the dashboard" });
      return;
    }
    await setStep("send");
    await sendCompanyEmail(companyId, emit);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateCompany(companyId, { status: "error", error: msg, current_step: null }).catch(() => {});
    emitRaw({ step: "scrape", status: "fail", message: `Pipeline error: ${msg}` });
    await logEvent(companyId, "pipeline", msg, null, "error").catch(() => {});
  }
}

/** Body word count excluding greeting-free sign-off lines (short trailing lines like "Best," / name / company). */
function countWords(body: string) {
  const lines = body.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
  while (lines.length > 1 && lines[lines.length - 1].split(/\s+/).length <= 5) lines.pop();
  return lines.join(" ").split(/\s+/).filter(Boolean).length;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Step 7. Sends to OUR inbox only, with a decision trail appended so the email explains itself. */
export async function sendCompanyEmail(companyId: string, emit?: Emit) {
  const { data: c } = await db().from("sprinto_companies").select("*").eq("id", companyId).single();
  if (!c?.email) throw new Error("No draft to send");
  const e = c.email as Draft & { intended: string };
  const contact = c.contact?.chosen as LushaContact;
  const q = c.qualification;
  const appUrl = process.env.APP_URL ? `${process.env.APP_URL}/companies/${companyId}` : "";
  const trailText = `
---
TEST SEND - this would go to ${e.intended}. Delivered only to ${outreachInbox()}.
Why this company: ${q.total}/100 (pass ≥ ${q.pass_score}). ${q.summary}
Why this person: ${c.contact.reason}
Pains: ${(c.pains.chosen as Pain[]).map((p) => `${p.title} (${p.confidence}/10)`).join("; ")}
Hook: ${e.hook?.text} [${e.hook?.source_url}]
${appUrl ? `Full evidence: ${appUrl}` : ""}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#111">${esc(e.body).replace(/\n/g, "<br>")}</div>
<div style="margin-top:28px;padding:14px 16px;border:1px solid #e3e6ee;border-radius:8px;background:#f6f8fb;font-family:Arial,sans-serif;font-size:12px;color:#4a5568;line-height:1.5">
<b>TEST SEND</b> - intended for <b>${esc(contact.firstName)} ${esc(contact.lastName)}</b>, ${esc(contact.title)} at ${esc(c.name)}. Delivered only to ${esc(outreachInbox())}.<br>
<b>Why this company:</b> ${q.total}/100 (pass ≥ ${q.pass_score}). ${esc(q.summary)}<br>
<b>Why this person:</b> ${esc(c.contact.reason)}<br>
<b>Pain points:</b> ${(c.pains.chosen as Pain[]).map((p) => `${esc(p.title)} (${p.confidence}/10)`).join(" · ")}<br>
<b>Hook source:</b> <a href="${esc(e.hook?.source_url ?? "")}">${esc(e.hook?.source_url ?? "")}</a>
${appUrl ? `<br><a href="${appUrl}">Open full decision trail →</a>` : ""}
</div>`;
  emit?.({ step: "send", status: "start", message: `Sending to own inbox ${maskEmail(outreachInbox())} (intended: ${e.intended})` });
  const info = await sendOutreach({ subject: e.subject, text: e.body + "\n" + trailText, html });
  await updateCompany(companyId, { status: "sent", current_step: null, sent_at: new Date().toISOString(), message_id: info.id });
  if (emit) emit({ step: "send", status: "done", message: `Sent via ${info.transport} to ${maskEmail(info.to)}` });
  else await logEvent(companyId, "send", `Sent via ${info.transport} to ${maskEmail(info.to)}`, { id: info.id }, "decision");
  return info;
}
