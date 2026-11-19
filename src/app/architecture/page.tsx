import { ComponentMap } from "@/components/ComponentMap";
import { PageHeaderStatic } from "@/components/PageHeaderStatic";

const DECISIONS = [
  {
    q: "Why does a company qualify?",
    a: "Gemini scores five weighted criteria (SaaS 20, growth stage 20, enterprise motion 20, compliance trigger 25, sensitive data 15) from cited evidence. Code adds the points and applies three hard gates: not SaaS, a competitor, or over 5000 staff means out. Pass mark is 65/100. If a heavy criterion rests on low-confidence evidence, the agent fetches another page or searches news, for up to 3 rounds within an 8-page budget.",
  },
  {
    q: "Why this person?",
    a: "Lusha returns people at the domain with compliance-relevant titles. Code ranks them with a fixed ladder. At ≤200 staff the CTO or a technical founder usually runs the first SOC 2, so they come first. Above that, a CISO, Head of Security or GRC lead owns certifications. If nobody fits, the pipeline stops with NO_SUITABLE_CONTACT rather than emailing the wrong person.",
  },
  {
    q: "Why was the email written this way?",
    a: "The hook must be a specific, dated fact from the evidence, such as a funding round, a trust page, a hire or a framework list. It ties into the two highest-confidence pain points for that role. An AI critic scores the draft out of 10 and code checks the length is 80-120 words. The draft is rewritten up to twice, and the best version is kept.",
  },
  {
    q: "Why is it safe to run?",
    a: "The recipient is hardcoded to the owner's own inbox, and prospect email addresses are never fetched. Every sent email carries a footer explaining the decisions. Running and sending need a passcode, while viewing is public.",
  },
];

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeaderStatic title="How it works" sub="Component map: UI, AI, APIs and data flow, plus how each decision is made." />
      <div className="card overflow-x-auto p-3">
        <div className="min-w-[900px]">
          <ComponentMap />
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {DECISIONS.map((d) => (
          <div key={d.q} className="card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">{d.q}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{d.a}</p>
          </div>
        ))}
      </div>
      <div className="card mt-5 p-4 text-sm text-slate-600 sm:p-5">
        <h2 className="mb-2 text-sm font-semibold text-ink">Stack</h2>
        Next.js 16 on Vercel · Supabase Postgres (tables prefixed <code>sprinto_</code>) · Gemini 3.5 Flash in JSON mode · Exa (news search and JS-page
        reader) · Lusha v3 prospecting API · Gmail SMTP via nodemailer. Scraper: single-fetch, plain request first, cheerio cleaning rules, Exa reader as
        the fallback.
      </div>
    </div>
  );
}
