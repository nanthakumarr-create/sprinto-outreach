import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY missing");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export async function logEvent(
  companyId: string,
  step: string,
  message: string,
  data?: unknown,
  level: "info" | "warn" | "error" | "decision" = "info",
) {
  await db().from("sprinto_events").insert({ company_id: companyId, step, message, data: data ?? null, level });
}

export async function updateCompany(id: string, patch: Record<string, unknown>) {
  const { error } = await db()
    .from("sprinto_companies")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`DB update failed: ${error.message}`);
}
