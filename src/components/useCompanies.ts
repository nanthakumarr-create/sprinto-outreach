"use client";
import { useCallback, useEffect, useState } from "react";
import { api, CompanyRow } from "@/lib/client";

export function useCompanies() {
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const { companies } = await api<{ companies: CompanyRow[] }>("/api/companies");
      setRows(companies);
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
  return { rows, err, loading, reload: load };
}
