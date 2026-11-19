"use client";

import { Check, X, Loader2, Minus } from "lucide-react";
import { STEPS, StepState } from "@/lib/client";

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  queued: ["Queued", "bg-slate-100 text-slate-600"],
  running: ["Running", "bg-indigo-50 text-indigo-700"],
  sent: ["Sent", "bg-emerald-50 text-emerald-700"],
  ready: ["Ready to send", "bg-amber-50 text-amber-700"],
  disqualified: ["Not a fit", "bg-slate-100 text-slate-600"],
  no_contact: ["No contact", "bg-orange-50 text-orange-700"],
  error: ["Error", "bg-rose-50 text-rose-700"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, "bg-slate-100 text-slate-600"];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function ScoreChip({ score, pass = 65, qualified }: { score: number | null; pass?: number; qualified?: boolean }) {
  if (score == null) return <span className="text-muted text-sm">-</span>;
  const ok = qualified ?? score >= pass;
  return (
    <span className={`inline-flex min-w-11 justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      {score}
    </span>
  );
}

export function StepTrack({ states, compact }: { states: Partial<Record<string, StepState>>; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const st = states[s.key] ?? "idle";
        const cls =
          st === "done"
            ? "bg-emerald-500 text-white border-emerald-500"
            : st === "running"
            ? "bg-indigo-600 text-white border-indigo-600 pulse"
            : st === "fail"
            ? "bg-rose-500 text-white border-rose-500"
            : st === "skip"
            ? "bg-slate-100 text-slate-400 border-slate-200"
            : "bg-white text-slate-400 border-slate-200";
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div title={`${s.label}: ${st}`} className={`grid ${compact ? "h-5 w-5" : "h-7 w-7"} place-items-center rounded-full border text-[10px] font-semibold ${cls}`}>
              {st === "done" ? <Check size={compact ? 11 : 14} /> : st === "fail" ? <X size={compact ? 11 : 14} /> : st === "running" ? <Loader2 size={compact ? 11 : 14} className="animate-spin" /> : st === "skip" ? <Minus size={compact ? 11 : 14} /> : s.short}
            </div>
            {!compact && <span className={`hidden xl:inline text-[11px] ${st === "idle" || st === "skip" ? "text-slate-400" : "text-slate-700"}`}>{s.label}</span>}
            {i < STEPS.length - 1 && <div className={`${compact ? "w-1.5" : "w-3"} h-px bg-slate-200`} />}
          </div>
        );
      })}
    </div>
  );
}

/** Derive step states for a finished company from its stored status. */
export function statesFromStatus(status: string, current: string | null, decision: string | null): Partial<Record<string, StepState>> {
  const keys = STEPS.map((s) => s.key);
  const out: Partial<Record<string, StepState>> = {};
  const fill = (upto: number, state: StepState) => keys.slice(0, upto).forEach((k) => (out[k] = state));
  if (status === "sent") fill(7, "done");
  else if (status === "ready") { fill(6, "done"); out.send = "idle"; }
  else if (status === "disqualified" || decision === "disqualified") { fill(3, "done"); keys.slice(3).forEach((k) => (out[k] = "skip")); }
  else if (status === "no_contact") { fill(3, "done"); out.contact = "fail"; keys.slice(4).forEach((k) => (out[k] = "skip")); }
  else if (status === "running" && current) { const i = keys.indexOf(current as never); fill(i, "done"); out[current] = "running"; }
  else if (status === "error") { const i = current ? keys.indexOf(current as never) : 0; fill(i, "done"); out[keys[Math.max(i, 0)]] = "fail"; }
  return out;
}

export function Stat({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        {label}
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-sm font-medium">{title}</div>
      {sub && <div className="max-w-sm text-xs text-muted">{sub}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>;
}
