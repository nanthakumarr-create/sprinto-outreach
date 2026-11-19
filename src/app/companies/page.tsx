"use client";

import { PageHeader, ErrorBox } from "@/components/ui";
import { CompanyTable } from "@/components/CompanyTable";
import { useCompanies } from "@/components/useCompanies";

export default function CompaniesPage() {
  const { rows, err, loading } = useCompanies();
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Prospects" sub="Every company the pipeline has researched. Open one to see the full decision trail." />
      {err && (
        <div className="mb-4">
          <ErrorBox msg={err} />
        </div>
      )}
      <CompanyTable rows={rows} loading={loading} />
    </div>
  );
}
