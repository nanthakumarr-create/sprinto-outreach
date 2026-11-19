"use client";
import { CompanyRow } from "@/lib/client";

export function Funnel({ rows }: { rows: CompanyRow[] }) {
  const done = rows.filter((r) => r.status !== "queued" && r.status !== "running");
  const stages = [
    { label: "Researched", n: done.filter((r) => r.score != null).length },
    { label: "Qualified", n: done.filter((r) => r.decision === "qualified").length },
    { label: "Contact found", n: done.filter((r) => r.contact).length },
    { label: "Email drafted", n: done.filter((r) => r.subject).length },
    { label: "Sent to inbox", n: done.filter((r) => r.status === "sent").length },
  ];
  const max = Math.max(1, stages[0].n);
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => (
        <div key={s.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-600">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.n}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${(s.n / max) * 100}%`, opacity: 1 - i * 0.12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScoreDistribution({ rows, pass = 65 }: { rows: CompanyRow[]; pass?: number }) {
  const scored = rows.filter((r) => r.score != null);
  const buckets = Array.from({ length: 10 }, (_, i) => ({ lo: i * 10, n: 0 }));
  scored.forEach((r) => {
    buckets[Math.min(9, Math.floor(Number(r.score) / 10))].n++;
  });
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const W = 300;
  const H = 120;
  const bw = W / 10;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="ICP score distribution">
        {buckets.map((b, i) => {
          const h = (b.n / max) * (H - 14);
          return (
            <g key={i}>
              <rect x={i * bw + 3} y={H - h} width={bw - 6} height={h} rx={3} className={b.lo + 10 > pass ? "fill-emerald-500" : "fill-slate-300"} />
              {b.n > 0 && (
                <text x={i * bw + bw / 2} y={H - h - 3} textAnchor="middle" className="fill-slate-600 text-[9px]">
                  {b.n}
                </text>
              )}
              <text x={i * bw + bw / 2} y={H + 12} textAnchor="middle" className="fill-slate-400 text-[8px]">
                {b.lo}
              </text>
            </g>
          );
        })}
        <line x1={(pass / 100) * W} x2={(pass / 100) * W} y1={0} y2={H} className="stroke-indigo-500" strokeDasharray="3 3" />
        <text x={(pass / 100) * W + 3} y={9} className="fill-indigo-600 text-[8px] font-semibold">
          pass {pass}
        </text>
      </svg>
      <div className="mt-1 text-[11px] text-muted">{scored.length} scored companies · ICP score out of 100</div>
    </div>
  );
}
