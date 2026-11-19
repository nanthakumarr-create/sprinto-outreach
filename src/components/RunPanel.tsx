"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Loader2, Lock, ArrowUpRight } from "lucide-react";
import { api, getPasscode, setPasscode, StepState } from "@/lib/client";
import { StepTrack, ErrorBox } from "./ui";

type Live = { id: string; domain: string; states: Record<string, StepState>; log: { step: string; status: string; message: string }[]; done: boolean };

const SAMPLES = ["spotdraft.com", "rocketlane.com", "chaayos.com", "vanta.com", "atlan.com"];

export function RunPanel({ onFinished }: { onFinished: () => void }) {
  const [domains, setDomains] = useState("");
  const [autoSend, setAutoSend] = useState(true);
  const [pass, setPass] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved passcode from localStorage on mount
    setPass(getPasscode());
  }, []);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [live, setLive] = useState<Live[]>([]);

  const update = (id: string, fn: (l: Live) => Live) => setLive((prev) => prev.map((l) => (l.id === id ? fn(l) : l)));

  async function start() {
    setErr("");
    setRunning(true);
    try {
      setPasscode(pass);
      const { companies } = await api<{ companies: { id: string; domain: string }[]; run: { id: string } }>("/api/runs", {
        method: "POST",
        json: { domains, autoSend, passcode: pass },
      });
      setLive(companies.map((c) => ({ id: c.id, domain: c.domain, states: {}, log: [], done: false })));
      for (const c of companies) {
        update(c.id, (l) => ({ ...l, states: { scrape: "running" } }));
        const res = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: c.id, passcode: pass }),
        });
        if (!res.ok || !res.body) {
          update(c.id, (l) => ({ ...l, done: true, states: { scrape: "fail" }, log: [{ step: "scrape", status: "fail", message: `Request failed (${res.status})` }] }));
          continue;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line) as { step: string; status: string; message: string };
            if (e.step === "end") continue;
            update(c.id, (l) => {
              const states = { ...l.states };
              states[e.step] = e.status === "start" || e.status === "progress" ? "running" : e.status === "done" ? "done" : e.status === "fail" ? "fail" : "skip";
              return { ...l, states, log: [...l.log, e] };
            });
          }
        }
        update(c.id, (l) => ({ ...l, done: true }));
        onFinished();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      onFinished();
    }
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Run the pipeline</h2>
        <span className="text-xs text-muted">Up to 10 domains per run</span>
      </div>
      <textarea
        value={domains}
        onChange={(e) => setDomains(e.target.value)}
        placeholder={"spotdraft.com\nrocketlane.com"}
        rows={3}
        className="mt-3 w-full resize-y rounded-lg border border-line bg-slate-50/60 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-400 focus:bg-white"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="text-xs text-muted py-1">Try:</span>
        {SAMPLES.map((s) => (
          <button key={s} onClick={() => setDomains((d) => (d.includes(s) ? d : (d.trim() ? d.trim() + "\n" : "") + s))} className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
            + {s}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
          Auto-send when QA passes
        </label>
        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <div className="relative flex-1 sm:max-w-44">
            <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Passcode" className="w-full rounded-lg border border-line py-2 pl-8 pr-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <button onClick={start} disabled={running || !domains.trim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>
      {err && <div className="mt-3"><ErrorBox msg={err} /></div>}

      {live.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          {live.map((l) => {
            const last = l.log[l.log.length - 1];
            return (
              <div key={l.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-sm font-medium">
                    {l.domain}
                    {l.done && (
                      <Link href={`/companies/${l.id}`} className="inline-flex items-center gap-0.5 font-sans text-xs font-medium text-indigo-600 hover:underline">
                        decision trail <ArrowUpRight size={12} />
                      </Link>
                    )}
                  </div>
                  <StepTrack states={l.states} compact />
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto scroll-thin rounded-md bg-slate-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
                  {l.log.length === 0 && <div className="text-slate-500">waiting…</div>}
                  {l.log.map((e, i) => (
                    <div key={i} className={e.status === "fail" ? "text-rose-400" : e.status === "done" ? "text-emerald-300" : e.status === "skip" ? "text-slate-500" : ""}>
                      <span className="text-slate-500">[{e.step}]</span> {e.message}
                    </div>
                  ))}
                </div>
                {!l.done && last && <div className="mt-1.5 text-[11px] text-muted">Working: {last.step}…</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
