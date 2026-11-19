"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CompanyRow, fmtDate } from "@/lib/client";
import { StatusBadge, ScoreChip, StepTrack, statesFromStatus, Empty, Skeleton } from "./ui";

const FILTERS = [
  ["all", "All"],
  ["sent", "Sent"],
  ["ready", "Ready"],
  ["disqualified", "Not a fit"],
  ["no_contact", "No contact"],
  ["error", "Error"],
] as const;

export function CompanyTable({ rows, loading, limit, showFilters = true }: { rows: CompanyRow[] | null; loading?: boolean; limit?: number; showFilters?: boolean }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<string>("all");
  const list = useMemo(() => {
    let r = rows ?? [];
    if (f !== "all") r = r.filter((c) => c.status === f);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((c) => [c.domain, c.name, c.contact?.name, c.contact?.title, c.one_liner].some((v) => v?.toLowerCase().includes(s)));
    }
    return limit ? r.slice(0, limit) : r;
  }, [rows, q, f, limit]);

  return (
    <div className="card overflow-hidden">
      {showFilters && (
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setF(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${f === k ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {label}
                {rows && k !== "all" && <span className="ml-1 opacity-70">{rows.filter((c) => c.status === k).length}</span>}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, person…" className="w-full rounded-lg border border-line py-1.5 pl-8 pr-2 text-sm outline-none focus:border-indigo-400" />
          </div>
        </div>
      )}
      {loading && !rows ? (
        <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : list.length === 0 ? (
        <Empty title={rows?.length ? "No prospects match" : "No prospects yet"} sub={rows?.length ? "Try another filter or search." : "Paste a few company domains above and press Run."} />
      ) : (
        <>
          {/* desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-slate-50 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">ICP</th>
                <th className="px-3 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Pipeline</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${c.id}`} className="font-medium hover:text-indigo-700">{c.name || c.domain}</Link>
                    <div className="max-w-xs truncate text-xs text-muted">{c.domain}{c.funding ? ` · ${c.funding}` : ""}</div>
                  </td>
                  <td className="px-3 py-3"><ScoreChip score={c.score} /></td>
                  <td className="px-3 py-3">
                    {c.contact ? (<><div className="font-medium">{c.contact.name}</div><div className="max-w-48 truncate text-xs text-muted">{c.contact.title}</div></>) : <span className="text-muted">-</span>}
                  </td>
                  <td className="px-3 py-3"><StepTrack compact states={statesFromStatus(c.status, c.current_step, c.decision)} /></td>
                  <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-right text-xs text-muted whitespace-nowrap">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* mobile cards */}
          <div className="divide-y divide-line md:hidden">
            {list.map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{c.name || c.domain}</div>
                    <div className="truncate text-xs text-muted">{c.contact ? `${c.contact.name} · ${c.contact.title}` : c.domain}</div>
                  </div>
                  <ScoreChip score={c.score} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <StepTrack compact states={statesFromStatus(c.status, c.current_step, c.decision)} />
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
