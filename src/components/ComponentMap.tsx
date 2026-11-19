/* Component map: UI, AI, APIs and data flow. Pure SVG so it renders crisply and can be exported as an image. */

type Kind = "ui" | "code" | "ai" | "api" | "data" | "out";
type Node = { id: string; x: number; y: number; w: number; h: number; kind: Kind; title: string; lines: string[]; tag?: string };
type Side = "l" | "r" | "t" | "b";
type Edge = { from: string; to: string; fs: Side; ts: Side; label?: string; dashed?: boolean; lx?: number; ly?: number };

const COLORS: Record<Kind, { fill: string; stroke: string; tag: string; name: string }> = {
  ui: { fill: "#e8eefc", stroke: "#4f6bdc", tag: "#3446a8", name: "UI (Next.js on Vercel)" },
  code: { fill: "#fdf5dc", stroke: "#d4a72c", tag: "#8a6a0b", name: "Plain code (no AI)" },
  ai: { fill: "#fde7ea", stroke: "#d9506a", tag: "#a3203a", name: "AI model (Gemini 3.5 Flash)" },
  api: { fill: "#e3f5ea", stroke: "#3a9d62", tag: "#1f6e40", name: "External API / live data" },
  data: { fill: "#efe8fb", stroke: "#8b5cf6", tag: "#5b2fc0", name: "Data (Supabase Postgres)" },
  out: { fill: "#dff4f4", stroke: "#1f9e9e", tag: "#11706f", name: "Output (Gmail)" },
};

const X = (i: number) => 210 + i * 200;
const PY = 300;

const NODES: Node[] = [
  { id: "ui", x: 20, y: PY, w: 165, h: 140, kind: "ui", tag: "TRIGGER", title: "Dashboard", lines: ["Paste domains", "Passcode + Run", "Auto-send toggle", "Live step stream"] },
  { id: "scrape", x: X(0), y: PY, w: 170, h: 140, kind: "code", tag: "STEP 1", title: "Scrape", lines: ["Homepage + 3 best pages", "(security, about,", "customers, pricing)", "Strip nav/footer/cookies", "8-page budget, 3 tries"] },
  { id: "extract", x: X(1), y: PY, w: 170, h: 140, kind: "ai", tag: "STEP 2", title: "Extract", lines: ["Structured company facts", "SaaS? size, funding,", "certs, enterprise &", "compliance signals", "each with source URL"] },
  { id: "qualify", x: X(2), y: PY, w: 170, h: 140, kind: "ai", tag: "STEP 3 · AGENT LOOP", title: "Qualify", lines: ["AI scores 5 criteria 0-10", "asks for more evidence", "(fetch page / news search)", "≤3 rounds · code sums", "weights + hard gates"] },
  { id: "contact", x: X(3), y: PY, w: 170, h: 140, kind: "code", tag: "STEP 4", title: "Find PoC", lines: ["Qualified only (≥65)", "Rank by role ladder:", "≤200 staff → CTO first", ">200 → CISO / GRC first", "none → NO_CONTACT stop"] },
  { id: "pains", x: X(4), y: PY, w: 170, h: 140, kind: "ai", tag: "STEP 5", title: "Pain points", lines: ["4 hypotheses for this", "person's role, each", "cited to evidence", "keep top 2 with", "confidence ≥7/10"] },
  { id: "draft", x: X(5), y: PY, w: 170, h: 140, kind: "ai", tag: "STEP 6", title: "Draft + QA", lines: ["By first name, one", "dated hook, 80-120 words", "AI critic scores /10", "rewrite ≤2× until ≥8", "best version kept"] },
  { id: "send", x: X(6), y: PY, w: 170, h: 140, kind: "out", tag: "STEP 7", title: "Send", lines: ["Gmail SMTP", "To: HARDCODED own", "Mesa inbox only", "+ decision-trail footer", "prospects never emailed"] },

  { id: "web", x: X(0), y: 110, w: 170, h: 95, kind: "api", title: "Company website", lines: ["Plain HTTP fetch", "Exa reader fallback (JS)", "LinkedIn never scraped"] },
  { id: "exa", x: X(2), y: 110, w: 170, h: 95, kind: "api", title: "Exa search", lines: ["Dated news: funding,", "hiring, SOC 2, deals", "called only when asked"] },
  { id: "lusha", x: X(3), y: 110, w: 170, h: 95, kind: "api", title: "Lusha API (v3)", lines: ["Prospecting by domain", "+ role titles · 1 credit", "names/titles only"] },
  { id: "gemini", x: X(4), y: 110, w: 370, h: 95, kind: "ai", title: "Gemini 3.5 Flash (JSON mode)", lines: ["Used by steps 2, 3, 5, 6 · temperature 0.2-0.6", "Rules: cite source_url, never invent facts or stats"] },

  { id: "rubric", x: X(2), y: 520, w: 170, h: 95, kind: "data", title: "sprinto_rubric", lines: ["Versioned ICP weights,", "gates, thresholds", "editable in dashboard"] },
  { id: "cache", x: X(3), y: 520, w: 170, h: 95, kind: "data", title: "sprinto_contact_cache", lines: ["Lusha results per", "domain, 14 days", "saves credits"] },
  { id: "companies", x: X(4), y: 520, w: 170, h: 95, kind: "data", title: "runs + companies", lines: ["facts, scores, rounds,", "contact, pains, email,", "status per company"] },
  { id: "events", x: X(5), y: 520, w: 170, h: 95, kind: "data", title: "sprinto_events", lines: ["Step-by-step log of", "every decision", "and failure"] },

  { id: "trail", x: X(0), y: 700, w: 370, h: 95, kind: "ui", tag: "REVIEW", title: "Decision trail page", lines: ["Why this company · why this person · why this email", "Evidence links, agent rounds, QA history, re-send"] },
  { id: "inbox", x: X(6), y: 700, w: 170, h: 95, kind: "out", tag: "FINISH LINE", title: "Own Gmail inbox", lines: ["Personalised email", "+ why-footer", "human reads & judges"] },
];

const EDGES: Edge[] = [
  { from: "ui", to: "scrape", fs: "r", ts: "l" },
  { from: "web", to: "scrape", fs: "b", ts: "t", label: "HTML → clean text" },
  { from: "scrape", to: "extract", fs: "r", ts: "l" },
  { from: "extract", to: "qualify", fs: "r", ts: "l" },
  { from: "qualify", to: "exa", fs: "t", ts: "b", label: "more evidence? ↺", dashed: true },
  { from: "rubric", to: "qualify", fs: "t", ts: "b", label: "weights + gates" },
  { from: "qualify", to: "contact", fs: "r", ts: "l" },
  { from: "lusha", to: "contact", fs: "b", ts: "t", label: "people" },
  { from: "contact", to: "cache", fs: "b", ts: "t", label: "cache", dashed: true },
  { from: "contact", to: "pains", fs: "r", ts: "l" },
  { from: "gemini", to: "pains", fs: "b", ts: "t" },
  { from: "pains", to: "draft", fs: "r", ts: "l" },
  { from: "draft", to: "send", fs: "r", ts: "l" },
  { from: "pains", to: "companies", fs: "b", ts: "t", label: "every step saves", dashed: true },
  { from: "companies", to: "events", fs: "r", ts: "l", dashed: true },
  { from: "send", to: "inbox", fs: "b", ts: "t", label: "to: own inbox" },
  { from: "companies", to: "trail", fs: "b", ts: "r", label: "dashboard reads", dashed: true },
];

function anchor(n: Node, s: Side) {
  if (s === "l") return { x: n.x, y: n.y + n.h / 2 };
  if (s === "r") return { x: n.x + n.w, y: n.y + n.h / 2 };
  if (s === "t") return { x: n.x + n.w / 2, y: n.y };
  return { x: n.x + n.w / 2, y: n.y + n.h };
}

function path(e: Edge) {
  const a = NODES.find((n) => n.id === e.from)!;
  const b = NODES.find((n) => n.id === e.to)!;
  const p = anchor(a, e.fs);
  const q = anchor(b, e.ts);
  // keep vertical links straight when nodes overlap horizontally
  if ((e.fs === "t" || e.fs === "b") && (e.ts === "t" || e.ts === "b")) {
    const lo = Math.max(a.x, b.x);
    const hi = Math.min(a.x + a.w, b.x + b.w);
    if (hi > lo) {
      const x = (lo + hi) / 2;
      return { d: `M${x},${p.y} V${q.y}`, mid: { x, y: (p.y + q.y) / 2 } };
    }
  }
  if (e.fs === "b" && e.ts === "r") return { d: `M${p.x},${p.y} V${q.y} H${q.x}`, mid: { x: (p.x + q.x) / 2, y: q.y } };
  return { d: `M${p.x},${p.y} L${q.x},${q.y}`, mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } };
}

export function ComponentMap() {
  const W = 1610;
  const H = 905;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#ffffff" }} role="img" aria-label="Component map of the Sprinto outreach system">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#1e293b" />
        </marker>
      </defs>
      <text x={20} y={38} fontSize={24} fontWeight={700} fill="#0b1533">
        Component Map: Sprinto Cold Outreach System
      </text>
      <text x={20} y={62} fontSize={13} fill="#475569">
        Domains in → scrape → extract → qualify (agent loop) → find PoC → 2 pain points → personalised email → sent to own Gmail inbox only. Hosted on Vercel · code on GitHub · data in Supabase.
      </text>

      {/* lane labels */}
      {[
        [110, "EXTERNAL APIs + AI"],
        [300, "PIPELINE (per company)"],
        [520, "DATA (Supabase)"],
        [700, "OUTPUT + REVIEW"],
      ].map(([y, t]) => (
        <g key={t as string}>
          <line x1={20} x2={W - 20} y1={(y as number) - 14} y2={(y as number) - 14} stroke="#e2e8f0" />
          <text x={20} y={(y as number) - 20} fontSize={10} fontWeight={700} fill="#94a3b8" letterSpacing={1}>
            {t}
          </text>
        </g>
      ))}

      {EDGES.map((e, i) => {
        const { d, mid } = path(e);
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#1e293b" strokeWidth={1.4} strokeDasharray={e.dashed ? "5 4" : undefined} markerEnd="url(#arr)" markerStart={e.label?.includes("↺") ? "url(#arr)" : undefined} />
            {e.label && (
              <g>
                <rect x={mid.x - e.label.length * 3.1 - 4} y={mid.y - 9} width={e.label.length * 6.2 + 8} height={16} rx={3} fill="#ffffff" />
                <text x={mid.x} y={mid.y + 3} fontSize={10.5} fontStyle="italic" fill="#334155" textAnchor="middle">
                  {e.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {NODES.map((n) => {
        const c = COLORS[n.kind];
        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={9} fill={c.fill} stroke={c.stroke} strokeWidth={1.6} />
            {n.tag && (
              <text x={n.x + 10} y={n.y + 16} fontSize={9} fontWeight={700} fill={c.tag} letterSpacing={0.6}>
                {n.tag}
              </text>
            )}
            <text x={n.x + 10} y={n.y + (n.tag ? 34 : 22)} fontSize={14} fontWeight={700} fill="#0f172a">
              {n.title}
            </text>
            {n.lines.map((l, i) => (
              <text key={i} x={n.x + 10} y={n.y + (n.tag ? 52 : 40) + i * 15} fontSize={11} fill="#334155">
                {l}
              </text>
            ))}
          </g>
        );
      })}

      {/* legend */}
      <g transform={`translate(20, ${H - 75})`}>
        {(Object.keys(COLORS) as Kind[]).map((k, i) => (
          <g key={k} transform={`translate(${i * 215}, 0)`}>
            <rect width={16} height={12} rx={3} fill={COLORS[k].fill} stroke={COLORS[k].stroke} />
            <text x={22} y={10} fontSize={11} fill="#334155">
              {COLORS[k].name}
            </text>
          </g>
        ))}
        <text x={1300} y={10} fontSize={11} fill="#334155">
          ── data flow · - - - async / storage
        </text>
        <text x={0} y={36} fontSize={11.5} fill="#475569">
          Decisions are explainable: AI only scores and writes; code applies weights, gates, contact ranking, word limits and the hardcoded recipient. Every fact carries a source URL.
        </text>
        <text x={0} y={54} fontSize={11.5} fill="#475569">
          Stops early: not SaaS / competitor / &gt;5000 staff / score &lt;65 → no contact lookup; NO_SUITABLE_CONTACT → no email; QA &lt;8 after 2 rewrites → held for human review.
        </text>
      </g>
    </svg>
  );
}
