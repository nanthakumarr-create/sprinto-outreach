import "server-only";
import * as cheerio from "cheerio";
import { exaContents } from "./exa";

export type PageDoc = {
  url: string;
  kind: "home" | "page" | "news" | "search";
  title: string;
  text: string; // cleaned, trimmed
  chars: number; // cleaned length before trim
  rawChars: number; // raw HTML length
  via: "fetch" | "exa" | "exa-search";
  publishedDate?: string | null;
};

export type ScrapeResult = { doc: PageDoc | null; links: { url: string; label: string }[]; error?: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_TEXT = 5000;

// Boilerplate the model should never see (lecture: "cleaning is a list of rules").
const NOISE_SELECTORS = [
  "script", "style", "noscript", "svg", "iframe", "form", "nav", "footer", "header",
  "[role=navigation]", "[role=banner]", "[role=contentinfo]", "[aria-hidden=true]",
  "[class*=cookie]", "[id*=cookie]", "[class*=consent]", "[id*=consent]", "[class*=banner]",
  "[class*=modal]", "[class*=popup]", "[class*=newsletter]", "[class*=footer]", "[class*=navbar]",
];
const NOISE_LINES = /^(home|login|log in|sign in|sign up|get started|book a demo|request a demo|contact( us)?|pricing|blog|careers|accept( all)?|cookie settings|privacy policy|terms.*|all rights reserved.*|©.*)$/i;

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
}

function cleanText($: cheerio.CheerioAPI): string {
  NOISE_SELECTORS.forEach((s) => $(s).remove());
  const root = $("main").length ? $("main") : $("body");
  const blocks: string[] = [];
  root.find("h1,h2,h3,h4,p,li,blockquote,td,span,a,div").each((_, el) => {
    const $el = $(el);
    // only leaf-ish elements to avoid duplication
    if ($el.children("h1,h2,h3,h4,p,li,div,ul,ol,table,section").length) return;
    const t = $el.text().replace(/\s+/g, " ").trim();
    if (t.length < 3 || NOISE_LINES.test(t)) return;
    blocks.push(t);
  });
  // de-duplicate repeated blocks (menus, repeated CTAs)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of blocks) {
    const k = b.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out.join("\n");
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) throw new Error(`Not HTML (${ct})`);
    return { html: await res.text(), finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

/** Single-fetch scraper: plain request first, Exa reader as fallback for JS-rendered or blocked pages. Max 3 tries. */
export async function scrapePage(url: string, kind: PageDoc["kind"]): Promise<ScrapeResult> {
  if (/linkedin\.com/i.test(url)) return { doc: null, links: [], error: "LinkedIn is never scraped (policy)" };
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { html, finalUrl } = await fetchHtml(url);
      const $ = cheerio.load(html);
      const title = $("title").first().text().trim();
      const metaDesc = $('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content") ?? "";
      const base = new URL(finalUrl);
      const links: { url: string; label: string }[] = [];
      $("a[href]").each((_, a) => {
        try {
          const u = new URL($(a).attr("href")!, base);
          if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) return;
          u.hash = "";
          links.push({ url: u.toString(), label: $(a).text().replace(/\s+/g, " ").trim().slice(0, 60) });
        } catch {}
      });
      const cleaned = [metaDesc, cleanText($)].filter(Boolean).join("\n");
      if (cleaned.length < 300) throw new Error("Page shell is nearly empty (JavaScript-rendered)");
      return {
        doc: { url: finalUrl, kind, title, text: cleaned.slice(0, MAX_TEXT), chars: cleaned.length, rawChars: html.length, via: "fetch" },
        links: dedupeLinks(links),
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (/HTTP 4\d\d|Not HTML|nearly empty/.test(lastError)) break; // no point retrying
    }
  }
  // 3rd try: hosted reader (handles JS rendering / bot walls)
  const text = await exaContents(url).catch(() => null);
  if (text && text.length > 200) {
    return {
      doc: { url, kind, title: "", text: text.slice(0, MAX_TEXT), chars: text.length, rawChars: 0, via: "exa" },
      links: [],
    };
  }
  return { doc: null, links: [], error: `Retrieval failure: ${lastError}` };
}

function dedupeLinks(links: { url: string; label: string }[]) {
  const map = new Map<string, string>();
  for (const l of links) {
    const key = l.url.replace(/\/$/, "");
    if (!map.has(key) || (l.label && !map.get(key))) map.set(key, l.label);
  }
  return [...map.entries()].map(([url, label]) => ({ url, label }));
}

// Pages most likely to carry ICP signal, in priority order.
const PAGE_PRIORITY: [RegExp, string][] = [
  [/(security|trust|compliance|soc-?2|gdpr|privacy-?center)/i, "security/trust"],
  [/(about|company|our-story|team)/i, "about"],
  [/(customers|case-stud|success-stor)/i, "customers"],
  [/(pricing|plans|enterprise)/i, "pricing/enterprise"],
  [/(careers|jobs|join)/i, "careers"],
];

export function pickPages(links: { url: string; label: string }[], limit: number, exclude: Set<string>) {
  const chosen: { url: string; reason: string }[] = [];
  for (const [re, reason] of PAGE_PRIORITY) {
    const hit = links.find((l) => {
      const path = new URL(l.url).pathname;
      return path.length > 1 && path.split("/").length <= 3 && (re.test(path) || re.test(l.label)) && !exclude.has(l.url.replace(/\/$/, ""));
    });
    if (hit) {
      chosen.push({ url: hit.url, reason });
      exclude.add(hit.url.replace(/\/$/, ""));
    }
    if (chosen.length >= limit) break;
  }
  return chosen;
}
