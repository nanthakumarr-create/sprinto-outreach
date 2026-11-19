"use client";

export const STEPS = [
  { key: "scrape", label: "Scrape", short: "1" },
  { key: "extract", label: "Extract", short: "2" },
  { key: "qualify", label: "Qualify", short: "3" },
  { key: "contact", label: "Contact", short: "4" },
  { key: "pains", label: "Pains", short: "5" },
  { key: "draft", label: "Draft", short: "6" },
  { key: "send", label: "Send", short: "7" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];
export type StepState = "idle" | "running" | "done" | "fail" | "skip";

export type CompanyRow = {
  id: string;
  run_id: string;
  domain: string;
  name: string | null;
  status: string;
  current_step: string | null;
  score: number | null;
  decision: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  one_liner: string | null;
  funding: string | null;
  employees: number | null;
  contact: { name: string; title: string } | null;
  subject: string | null;
  qa: number | null;
  rubric_version: number | null;
};

const PASS_KEY = "sprinto-passcode";
export function getPasscode() {
  try {
    return localStorage.getItem(PASS_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setPasscode(p: string) {
  try {
    localStorage.setItem(PASS_KEY, p);
  } catch {}
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
