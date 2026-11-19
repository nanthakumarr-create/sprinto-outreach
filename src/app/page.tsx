"use client";

import Link from "next/link";
import { Building2, CheckCircle2, Mail, Gauge } from "lucide-react";
import { PageHeader, Stat, ErrorBox } from "@/components/ui";
import { RunPanel } from "@/components/RunPanel";
import { CompanyTable } from "@/components/CompanyTable";
import { Funnel, ScoreDistribution } from "@/components/Charts";
import { useCompanies } from "@/components/useCompanies";

export default function Dashboard() {
  const { rows, err, loading, reload } = useCompanies();
  const all = rows ?? [];
  const researched = all.filter((r) => r.score != null);
  const qualified = all.filter((r) => r.decision === "qualified");
  const sent = all.filter((r) => r.status === "sent");
  const avg = researched.length ? Math.round(researched.reduce((a, r) => a + Number(r.score), 0) / researched.length) : null;
  const dash = loading && !rows ? "…" : undefined;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Outbound pipeline"
        sub="Domains in → ICP check with an agent loop → right person → two pains → personalised email in your inbox."
      />
      {err && (
        <div className="mb-4">
          <ErrorBox msg={err} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Companies researched" value={dash ?? researched.length} sub={`${all.length} total in pipeline`} icon={<Building2 size={16} className="text-slate-400" />} />
        <Stat
          label="Qualified (ICP fit)"
          value={dash ?? qualified.length}
          sub={researched.length ? `${Math.round((qualified.length / researched.length) * 100)}% fit rate` : "no runs yet"}
          icon={<CheckCircle2 size={16} className="text-emerald-500" />}
        />
        <Stat label="Emails sent to inbox" value={dash ?? sent.length} sub="test mode · own inbox only" icon={<Mail size={16} className="text-indigo-500" />} />
        <Stat label="Avg ICP score" value={dash ?? avg ?? "-"} sub="pass mark 65 / 100" icon={<Gauge size={16} className="text-amber-500" />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <RunPanel onFinished={reload} />
        </div>
        <div className="space-y-5">
          <div className="card p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">Funnel</h2>
            <Funnel rows={all} />
          </div>
          <div className="card p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-semibold">ICP score distribution</h2>
            <ScoreDistribution rows={all} />
          </div>
        </div>
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent prospects</h2>
        <Link href="/companies" className="text-xs font-medium text-indigo-600 hover:underline">
          View all →
        </Link>
      </div>
      <CompanyTable rows={rows} loading={loading} limit={8} showFilters={false} />
    </div>
  );
}
