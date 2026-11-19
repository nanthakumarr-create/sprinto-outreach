import "server-only";
import { db } from "./db";

export type Criterion = { key: string; label: string; weight: number; guide: string };
export type Rubric = {
  version: number;
  pass_score: number; // out of 100
  criteria: Criterion[];
  max_employees: number;
  competitors: string[];
  max_rounds: number;
  page_budget: number;
  pain_min_confidence: number; // 1-10
  email: { min_words: number; max_words: number; qa_pass: number; max_revisions: number };
};

/**
 * Sprinto ICP, derived from the case brief + Sprinto's own positioning:
 * SaaS, Series A-C, either preparing for an audit or pushed by enterprise customers to certify.
 * Stored in Supabase (sprinto_rubric) so the Growth Lead can tune it without a deploy; this is only the seed.
 */
export const DEFAULT_RUBRIC: Rubric = {
  version: 1,
  pass_score: 65,
  criteria: [
    {
      key: "saas",
      label: "B2B SaaS / cloud product",
      weight: 20,
      guide: "10 = sells cloud software to businesses. 5 = software-enabled services or mixed. 0 = not software (agency, retail, hardware-only, consumer-only).",
    },
    {
      key: "stage",
      label: "Growth stage (Series A-C, ~20-1000 staff)",
      weight: 20,
      guide: "10 = Series A/B/C or clear evidence of 20-1000 employees. 6 = seed with traction. 3 = public / >2000 staff, or pre-product. Use funding news when the site is silent.",
    },
    {
      key: "enterprise_motion",
      label: "Sells to mid-market / enterprise",
      weight: 20,
      guide: "10 = enterprise plan, named enterprise logos, SSO/SAML, 'book a demo' sales motion, regulated-industry customers. 3 = self-serve SMB/consumer only.",
    },
    {
      key: "compliance_trigger",
      label: "Compliance trigger or pressure",
      weight: 25,
      guide: "10 = explicit trigger: 'SOC 2 in progress', recent raise + enterprise push, hiring security/compliance roles, expanding to EU/US, new framework needed (ISO 27001, HIPAA, GDPR). 6 = has a trust/security page but gaps in frameworks. 3 = already holds every major framework with mature security team. 0 = no sign compliance matters to them.",
    },
    {
      key: "data_sensitivity",
      label: "Handles sensitive customer data",
      weight: 15,
      guide: "10 = processes PII, financial, health, HR, or customer production data. 5 = moderate business data. 0 = no customer data.",
    },
  ],
  max_employees: 5000,
  competitors: [
    "sprinto.com", "vanta.com", "drata.com", "secureframe.com", "thoropass.com", "scrut.io", "hyperproof.io",
    "anecdotes.ai", "complyjet.com", "scytale.ai", "strikegraph.com", "laika.com", "oneleet.com", "delve.co",
  ],
  max_rounds: 3,
  page_budget: 8,
  pain_min_confidence: 7,
  email: { min_words: 80, max_words: 120, qa_pass: 8, max_revisions: 2 },
};

export async function loadRubric(): Promise<Rubric> {
  const { data } = await db()
    .from("sprinto_rubric")
    .select("config")
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.config) return data.config as Rubric;
  await db().from("sprinto_rubric").insert({ version: DEFAULT_RUBRIC.version, active: true, config: DEFAULT_RUBRIC });
  return DEFAULT_RUBRIC;
}

export const SPRINTO_CONTEXT = `
Sprinto (sprinto.com) is a compliance automation platform for SaaS and cloud companies.
What it does:
- Gets companies audit-ready for SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS and 20+ other frameworks from one control set.
- Integrates with the cloud stack (AWS/GCP/Azure, GitHub, HR tools, ticketing, MDM) and collects audit evidence automatically.
- Continuous control monitoring: flags drift (e.g. an unencrypted bucket, an offboarded employee who still has access) before the auditor sees it.
- Ready policy templates, employee security training and background-check tracking.
- Works with a network of audit firms; a trust center to answer enterprise security questionnaires faster.
Outcomes the buyer cares about: certification in weeks instead of months, engineers not pulled off roadmap to chase screenshots,
fewer stalled enterprise deals waiting on a SOC 2 report, adding the next framework without starting from scratch.
Never invent customer names, statistics, prices or guarantees about Sprinto.
`.trim();
