"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Building2, SlidersHorizontal, Network, Menu, X, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Prospects", icon: Building2 },
  { href: "/rubric", label: "ICP rubric", icon: SlidersHorizontal },
  { href: "/architecture", label: "How it works", icon: Network },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
            active(href) ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/6 hover:text-white"
          }`}
        >
          <Icon size={17} />
          {label}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500 text-white">
        <ShieldCheck size={18} />
      </div>
      <div>
        <div className="text-sm font-semibold text-white leading-tight">Sprinto Outreach</div>
        <div className="text-[11px] text-slate-400 leading-tight">ICP → contact → email</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <div className="hidden lg:block w-60 shrink-0 bg-navy">
      <aside className="flex flex-col gap-6 px-4 py-5 sticky top-0 h-screen">
        {brand}
        {nav}
        <div className="mt-auto rounded-lg bg-white/5 p-3 text-[11px] leading-relaxed text-slate-400">
          Test mode: every email goes to the owner&apos;s own inbox. Prospects are never contacted.
        </div>
      </aside>
      </div>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3">
        {brand}
        <button aria-label="Menu" onClick={() => setOpen(!open)} className="text-white p-1">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {open && <div className="lg:hidden sticky top-[56px] z-20 bg-navy px-4 pb-4">{nav}</div>}
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
    </div>
  );
}
