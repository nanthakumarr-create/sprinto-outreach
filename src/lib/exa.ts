import "server-only";

export type NewsHit = { url: string; title: string; publishedDate: string | null; text: string };

/** News / web search used by the agent loop when the website alone is not enough. */
export async function exaSearch(query: string, opts: { news?: boolean; num?: number } = {}): Promise<NewsHit[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY missing");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      query,
      numResults: opts.num ?? 5,
      ...(opts.news ? { category: "news" } : {}),
      contents: { text: { maxCharacters: 1200 } },
    }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.results ?? []).map((r: Record<string, unknown>) => ({
    url: String(r.url),
    title: String(r.title ?? ""),
    publishedDate: (r.publishedDate as string) ?? null,
    text: String(r.text ?? "").replace(/\s+/g, " ").trim(),
  }));
}

/** Fallback reader for pages that block plain requests or render with JavaScript. */
export async function exaContents(url: string): Promise<string | null> {
  const key = process.env.EXA_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.exa.ai/contents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ urls: [url], text: { maxCharacters: 6000 } }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const t = json.results?.[0]?.text;
  return t ? String(t).replace(/\s+/g, " ").trim() : null;
}
