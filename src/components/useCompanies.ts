"use client";
import { useCallback, useEffect, useState } from "react";
import { api, CompanyRow } from "@/lib/client";

/** By default only shows runs scored with the active rubric version; older test runs stay in the DB. */
export function useCompanies(showAll = false) {
  const [all, setAll] = useState<CompanyRow[] | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const d = await api<{ companies: CompanyRow[]; active_version: number }>("/api/companies");
      setAll(d.companies);
      setActive(d.active_version);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage / fetch once on mount
    load();
  }, [load]);
  const rows = all && (showAll ? all : all.filter((c) => c.rubric_version === active));
  const hidden = all && rows ? all.length - rows.length : 0;
  return { rows, err, loading, reload: load, active, hidden };
}
