import "server-only";
import { db } from "./db";

export type LushaContact = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  seniority: string | null;
  departments: string[];
  linkedin: string | null;
  location: string | null;
};

const TITLE_QUERY = [
  "CTO", "Chief Technology Officer", "CISO", "Chief Information Security Officer", "Head of Security",
  "VP Security", "Head of Compliance", "Head of GRC", "Security Engineering Manager", "VP Engineering",
  "Head of Engineering", "Co-Founder", "Founder", "CEO",
];

/** Lusha V3 prospecting search: names + titles only (no email reveal - the email goes to our own inbox). Cached per domain for 14 days. */
export async function findContacts(domain: string): Promise<{ contacts: LushaContact[]; cached: boolean; credits: number }> {
  const cache = await db().from("sprinto_contact_cache").select("*").eq("domain", domain).maybeSingle();
  if (cache.data && Date.now() - new Date(cache.data.fetched_at).getTime() < 14 * 864e5) {
    return { contacts: cache.data.results as LushaContact[], cached: true, credits: 0 };
  }
  const key = process.env.LUSHA_API_KEY;
  if (!key) throw new Error("LUSHA_API_KEY missing");
  const res = await fetch("https://api.lusha.com/v3/contacts/prospecting", {
    method: "POST",
    headers: { "Content-Type": "application/json", api_key: key },
    body: JSON.stringify({
      pagination: { page: 0, size: 25 },
      filters: {
        companies: { include: { domains: [domain] } },
        contacts: { include: { jobTitles: TITLE_QUERY } },
      },
      options: { maxContactsPerCompany: 20 },
    }),
  });
  if (!res.ok) throw new Error(`Lusha ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const contacts: LushaContact[] = (json.results ?? []).map(// eslint-disable-next-line @typescript-eslint/no-explicit-any -- external API payload
    (r: Record<string, any>) => ({
    id: r.id,
    firstName: r.firstName ?? "",
    lastName: r.lastName ?? "",
    title: r.jobTitle?.title ?? "",
    seniority: r.jobTitle?.seniority ?? null,
    departments: r.jobTitle?.departments ?? [],
    linkedin: r.socialLinks?.linkedin ?? null,
    location: [r.location?.city, r.location?.country].filter(Boolean).join(", ") || null,
  }));
  await db().from("sprinto_contact_cache").upsert({ domain, results: contacts, fetched_at: new Date().toISOString() });
  return { contacts, cached: false, credits: json.billing?.creditsCharged ?? 0 };
}

/**
 * Deterministic PoC choice (no AI): who owns the compliance problem depends on company size.
 * Small companies: the CTO / technical founder runs the audit. Larger: a security/GRC leader owns it.
 */
export function rankContacts(contacts: LushaContact[], employees: number | null) {
  const small = employees == null || employees <= 200;
  const ladder: [RegExp, string, number][] = small
    ? [
        [/\b(cto|chief technology)/i, "CTO usually owns the first SOC 2 audit at this size", 100],
        [/\b(ciso|chief information security|head of security|vp,? security|director.*security)/i, "Dedicated security leader owns compliance", 95],
        [/\b(compliance|grc|risk)\b/i, "Owns compliance / GRC directly", 90],
        [/(founder.*(ceo|chief executive)|(ceo|chief executive).*founder)/i, "CEO/co-founder - signs off on audit spend; no CTO or security lead listed", 78],
        [/(co-?founder|founder)/i, "Technical/co-founder - the buyer before a security hire exists", 80],
        [/\b(vp|head|director).*(engineering)/i, "Engineering leader carries audit evidence work", 70],
        [/\bceo\b/i, "CEO signs off on audit spend at this size", 60],
      ]
    : [
        [/\b(ciso|chief information security|head of security|vp,? security|director.*security)/i, "Security leader owns certifications at this size", 100],
        [/\b(compliance|grc|risk)\b/i, "Owns compliance / GRC directly", 95],
        [/\b(cto|chief technology)/i, "CTO sponsors compliance when no CISO exists", 85],
        [/\b(vp|head|director).*(engineering)/i, "Engineering leader carries audit evidence work", 65],
        [/(founder.*(ceo|chief executive)|(ceo|chief executive).*founder)/i, "CEO/co-founder - signs off on audit spend; no CTO or security lead listed", 58],
        [/(co-?founder|founder)/i, "Co-founder - escalation path when no security/engineering lead is listed", 55],
        [/\bceo\b/i, "CEO - last resort", 40],
      ];
  const ranked = contacts
    .map((c) => {
      const rung = ladder.find(([re]) => re.test(c.title));
      return rung ? { contact: c, score: rung[2], reason: rung[1] } : null;
    })
    .filter((x): x is { contact: LushaContact; score: number; reason: string } => !!x && !!x.contact.firstName)
    .sort((a, b) => b.score - a.score);
  return { ranked, ladder: small ? "small (≤200 staff)" : "larger (>200 staff)" };
}
