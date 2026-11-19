"use client";

import { useState } from "react";
import { PageHeader, ErrorBox } from "@/components/ui";
import { CompanyTable } from "@/components/CompanyTable";
import { useCompanies } from "@/components/useCompanies";

export default function CompaniesPage() {
  const [showAll, setShowAll] = useState(false);
  const { rows, err, loading, active, hidden } = useCompanies(showAll);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Prospects"
        sub="Every company the pipeline has researched. Open one to see the full decision trail."
        right={
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-3.5 w-3.5 accent-indigo-600" />
            {showAll ? "Showing all rubric versions" : `Rubric v${active ?? "-"} only${hidden ? ` (${hidden} older hidden)` : ""}`}
          </label>
        }
      />
      {err && (
        <div className="mb-4">
          <ErrorBox msg={err} />
        </div>
      )}
      <CompanyTable rows={rows} loading={loading} />
    </div>
  );
}
