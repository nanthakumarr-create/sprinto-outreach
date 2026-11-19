import "server-only";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type Usage = { calls: number; inputTokens: number; outputTokens: number };
export const newUsage = (): Usage => ({ calls: 0, inputTokens: 0, outputTokens: 0 });

/** Calls Gemini in JSON mode and parses the result. Retries twice on bad JSON / transient errors. */
export async function geminiJSON<T>(opts: {
  system: string;
  prompt: string;
  usage?: Usage;
  temperature?: number;
}): Promise<T> {
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: opts.temperature ?? 0.2,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = await res.json();
      if (opts.usage) {
        opts.usage.calls++;
        opts.usage.inputTokens += json.usageMetadata?.promptTokenCount ?? 0;
        opts.usage.outputTokens += json.usageMetadata?.candidatesTokenCount ?? 0;
      }
      const text: string = (json.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      return JSON.parse(cleaned) as T;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
