export interface CompanyPeerEntry {
  peerCompany: string;
  similarityScore: number;
  peerTags: string[];
}

interface CompanyProfile {
  name: string;
  tags: string[];
}

// ── Tag taxonomy ──────────────────────────────────────────────────────────────
// saas · b2b · b2c · developer-tools · fintech · payments · e-commerce
// ai-ml · cloud-infra · cybersecurity · health-tech · hr-tech · edtech
// enterprise · startup · public · canadian · us · remote-first
// supply-chain · telco · aerospace · retail-tech · media · gaming

const PROFILES: CompanyProfile[] = [
  // ── Big Tech ──────────────────────────────────────────────────────────────
  { name: 'Google',      tags: ['b2b', 'b2c', 'ai-ml', 'cloud-infra', 'developer-tools', 'advertising', 'enterprise', 'public', 'us', 'remote-first'] },
  { name: 'Microsoft',   tags: ['b2b', 'enterprise', 'cloud-infra', 'developer-tools', 'ai-ml', 'saas', 'public', 'us'] },
  { name: 'Apple',       tags: ['b2c', 'hardware', 'mobile', 'enterprise', 'public', 'us', 'consumer'] },
  { name: 'Amazon',      tags: ['b2b', 'b2c', 'cloud-infra', 'e-commerce', 'enterprise', 'public', 'us', 'logistics'] },
  { name: 'Meta',        tags: ['b2c', 'social', 'advertising', 'ai-ml', 'public', 'us', 'consumer', 'mobile'] },
  { name: 'Netflix',     tags: ['b2c', 'media', 'streaming', 'public', 'us', 'consumer', 'remote-first'] },
  { name: 'Spotify',     tags: ['b2c', 'media', 'streaming', 'saas', 'public', 'us', 'consumer', 'remote-first'] },
  { name: 'Uber',        tags: ['b2c', 'marketplace', 'logistics', 'mobile', 'public', 'us', 'consumer'] },
  { name: 'Airbnb',      tags: ['b2c', 'marketplace', 'travel', 'public', 'us', 'consumer'] },
  { name: 'Salesforce',  tags: ['b2b', 'saas', 'crm', 'enterprise', 'public', 'us', 'cloud-infra'] },
  { name: 'Oracle',      tags: ['b2b', 'enterprise', 'database', 'cloud-infra', 'saas', 'public', 'us'] },
  { name: 'SAP',         tags: ['b2b', 'enterprise', 'erp', 'saas', 'public', 'supply-chain'] },

  // ── Developer Tools / Cloud ───────────────────────────────────────────────
  { name: 'GitHub',      tags: ['b2b', 'developer-tools', 'saas', 'cloud-infra', 'ai-ml', 'enterprise', 'us', 'remote-first'] },
  { name: 'Vercel',      tags: ['b2b', 'developer-tools', 'saas', 'cloud-infra', 'startup', 'us', 'remote-first'] },
  { name: 'Linear',      tags: ['b2b', 'developer-tools', 'saas', 'startup', 'us', 'remote-first', 'productivity'] },
  { name: 'Figma',       tags: ['b2b', 'developer-tools', 'saas', 'design', 'startup', 'us', 'remote-first', 'productivity'] },
  { name: 'Notion',      tags: ['b2b', 'b2c', 'saas', 'productivity', 'startup', 'us', 'remote-first', 'developer-tools'] },
  { name: 'Atlassian',   tags: ['b2b', 'developer-tools', 'saas', 'enterprise', 'productivity', 'public', 'us'] },
  { name: 'Stripe',      tags: ['b2b', 'fintech', 'payments', 'developer-tools', 'saas', 'startup', 'us', 'remote-first'] },
  { name: 'Twilio',      tags: ['b2b', 'developer-tools', 'saas', 'communications', 'cloud-infra', 'public', 'us'] },
  { name: 'Cloudflare',  tags: ['b2b', 'cloud-infra', 'cybersecurity', 'developer-tools', 'saas', 'public', 'us', 'remote-first'] },
  { name: 'Snowflake',   tags: ['b2b', 'cloud-infra', 'data', 'enterprise', 'saas', 'public', 'us', 'ai-ml'] },
  { name: 'Databricks',  tags: ['b2b', 'cloud-infra', 'data', 'ai-ml', 'enterprise', 'startup', 'us'] },
  { name: 'HashiCorp',   tags: ['b2b', 'developer-tools', 'cloud-infra', 'saas', 'enterprise', 'public', 'us', 'remote-first'] },
  { name: 'PlanetScale', tags: ['b2b', 'developer-tools', 'saas', 'database', 'cloud-infra', 'startup', 'us', 'remote-first'] },
  { name: 'Supabase',    tags: ['b2b', 'developer-tools', 'saas', 'database', 'cloud-infra', 'startup', 'remote-first', 'open-source'] },
  { name: 'Retool',      tags: ['b2b', 'developer-tools', 'saas', 'startup', 'us', 'enterprise', 'productivity'] },
  { name: 'Postman',     tags: ['b2b', 'developer-tools', 'saas', 'startup', 'us', 'remote-first'] },
  { name: 'Datadog',     tags: ['b2b', 'cloud-infra', 'developer-tools', 'saas', 'enterprise', 'public', 'us', 'observability'] },
  { name: 'New Relic',   tags: ['b2b', 'cloud-infra', 'developer-tools', 'saas', 'enterprise', 'public', 'us', 'observability'] },

  // ── Fintech / Payments ────────────────────────────────────────────────────
  { name: 'Shopify',     tags: ['b2b', 'e-commerce', 'fintech', 'payments', 'saas', 'public', 'canadian', 'remote-first'] },
  { name: 'Wealthsimple',tags: ['b2c', 'fintech', 'payments', 'investing', 'startup', 'canadian', 'toronto'] },
  { name: 'Nuvei',       tags: ['b2b', 'fintech', 'payments', 'enterprise', 'public', 'canadian', 'montreal'] },
  { name: 'Lightspeed',  tags: ['b2b', 'e-commerce', 'fintech', 'saas', 'public', 'canadian', 'montreal', 'retail-tech'] },
  { name: 'Clearco',     tags: ['b2b', 'fintech', 'e-commerce', 'startup', 'canadian', 'toronto'] },
  { name: 'Koho Financial', tags: ['b2c', 'fintech', 'neobank', 'payments', 'startup', 'canadian', 'toronto'] },
  { name: 'Neo Financial', tags: ['b2c', 'fintech', 'neobank', 'payments', 'startup', 'canadian'] },
  { name: 'Borrowell',   tags: ['b2c', 'fintech', 'lending', 'startup', 'canadian', 'toronto'] },
  { name: 'TouchBistro', tags: ['b2b', 'saas', 'fintech', 'retail-tech', 'startup', 'canadian', 'toronto'] },

  // ── Canadian AI / Tech ────────────────────────────────────────────────────
  { name: 'Cohere',      tags: ['b2b', 'ai-ml', 'developer-tools', 'saas', 'startup', 'canadian', 'toronto', 'llm'] },
  { name: 'Waabi',       tags: ['b2b', 'ai-ml', 'autonomous', 'startup', 'canadian', 'toronto'] },
  { name: 'BorealisAI',  tags: ['b2b', 'ai-ml', 'research', 'canadian', 'toronto'] },
  { name: 'Layer 6',     tags: ['b2b', 'ai-ml', 'fintech', 'research', 'canadian', 'toronto'] },
  { name: 'Darwin AI',   tags: ['b2b', 'ai-ml', 'startup', 'canadian', 'waterloo'] },
  { name: 'OpenAI',      tags: ['b2b', 'ai-ml', 'developer-tools', 'saas', 'startup', 'us', 'llm', 'enterprise'] },
  { name: 'Anthropic',   tags: ['b2b', 'ai-ml', 'developer-tools', 'saas', 'startup', 'us', 'llm', 'enterprise'] },
  { name: 'Mistral',     tags: ['b2b', 'ai-ml', 'developer-tools', 'saas', 'startup', 'llm', 'open-source'] },
  { name: 'Hugging Face',tags: ['b2b', 'ai-ml', 'developer-tools', 'saas', 'startup', 'llm', 'open-source', 'remote-first'] },
  { name: 'Perplexity',  tags: ['b2b', 'b2c', 'ai-ml', 'saas', 'startup', 'us', 'llm', 'consumer'] },

  // ── Canadian Enterprise / Supply Chain ───────────────────────────────────
  { name: 'Kinaxis',     tags: ['b2b', 'enterprise', 'supply-chain', 'saas', 'public', 'canadian', 'ontario'] },
  { name: 'OpenText',    tags: ['b2b', 'enterprise', 'saas', 'public', 'canadian', 'ontario', 'ecm'] },
  { name: 'Ceridian',    tags: ['b2b', 'hr-tech', 'saas', 'enterprise', 'public', 'canadian'] },
  { name: 'Descartes Systems', tags: ['b2b', 'enterprise', 'supply-chain', 'logistics', 'saas', 'public', 'canadian', 'ontario'] },
  { name: 'Tecsys',      tags: ['b2b', 'enterprise', 'supply-chain', 'saas', 'public', 'canadian', 'montreal'] },

  // ── Canadian Health / Edtech ──────────────────────────────────────────────
  { name: 'PointClickCare', tags: ['b2b', 'health-tech', 'saas', 'enterprise', 'public', 'canadian', 'ontario'] },
  { name: 'Jane App',    tags: ['b2b', 'health-tech', 'saas', 'startup', 'canadian', 'bc'] },
  { name: 'Maple',       tags: ['b2c', 'health-tech', 'telehealth', 'startup', 'canadian', 'toronto'] },
  { name: 'D2L',         tags: ['b2b', 'edtech', 'saas', 'enterprise', 'public', 'canadian', 'waterloo'] },
  { name: 'Top Hat',     tags: ['b2b', 'edtech', 'saas', 'startup', 'canadian', 'toronto'] },

  // ── Canadian Telco / Aerospace ────────────────────────────────────────────
  { name: 'Telus',       tags: ['b2b', 'b2c', 'telco', 'health-tech', 'public', 'canadian', 'bc'] },
  { name: 'Rogers',      tags: ['b2c', 'telco', 'media', 'public', 'canadian', 'toronto'] },
  { name: 'Bell Canada', tags: ['b2c', 'telco', 'media', 'public', 'canadian', 'montreal'] },
  { name: 'BlackBerry',  tags: ['b2b', 'cybersecurity', 'enterprise', 'saas', 'public', 'canadian', 'ontario'] },
  { name: 'Bombardier',  tags: ['b2b', 'aerospace', 'enterprise', 'public', 'canadian', 'montreal'] },
  { name: 'CAE',         tags: ['b2b', 'aerospace', 'simulation', 'enterprise', 'public', 'canadian', 'montreal'] },

  // ── HR Tech ───────────────────────────────────────────────────────────────
  { name: 'Humi',        tags: ['b2b', 'hr-tech', 'saas', 'startup', 'canadian', 'toronto'] },
  { name: 'Rippling',    tags: ['b2b', 'hr-tech', 'saas', 'enterprise', 'startup', 'us', 'remote-first'] },
  { name: 'Workday',     tags: ['b2b', 'hr-tech', 'saas', 'enterprise', 'public', 'us', 'erp'] },
  { name: 'Greenhouse',  tags: ['b2b', 'hr-tech', 'saas', 'startup', 'us', 'ats'] },
  { name: 'Lever',       tags: ['b2b', 'hr-tech', 'saas', 'startup', 'us', 'ats'] },
  { name: 'Lattice',     tags: ['b2b', 'hr-tech', 'saas', 'startup', 'us', 'performance'] },

  // ── Cybersecurity ─────────────────────────────────────────────────────────
  { name: 'CrowdStrike', tags: ['b2b', 'cybersecurity', 'saas', 'enterprise', 'public', 'us', 'cloud-infra'] },
  { name: 'SentinelOne', tags: ['b2b', 'cybersecurity', 'saas', 'enterprise', 'public', 'us'] },
  { name: 'Palo Alto Networks', tags: ['b2b', 'cybersecurity', 'enterprise', 'public', 'us', 'cloud-infra'] },
  { name: 'Arctic Wolf', tags: ['b2b', 'cybersecurity', 'saas', 'startup', 'canadian', 'ontario'] },
  { name: 'eSentire',    tags: ['b2b', 'cybersecurity', 'managed-services', 'startup', 'canadian', 'ontario'] },
];

// Build a lookup map (lowercase name → profile)
const PROFILE_MAP = new Map<string, CompanyProfile>(
  PROFILES.map((p) => [p.name.toLowerCase(), p]),
);

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizeKey(name: string): string {
  return name.toLowerCase().trim()
    .replace(/,?\s+(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|limited|incorporated)$/i, '');
}

export interface CompanyCatalogEntry {
  name: string;
  domain: string;
}

/**
 * All known companies with canonical casing and guessed domain,
 * derived from PROFILES. Used to power the watchlist search.
 */
export const COMPANY_CATALOG: CompanyCatalogEntry[] = PROFILES.map((p) => {
  const domain = p.name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9.-]/g, '') + '.com';
  return { name: p.name, domain };
});

/**
 * Looks up similar companies for a given anchor company name using
 * tag-based Jaccard similarity. Works for any company in PROFILES.
 * Returns top 6 peers with score ≥ 25%, excluding the anchor itself.
 */
export function getPeersForCompany(companyName: string): CompanyPeerEntry[] {
  const key = normalizeKey(companyName);
  const anchor = PROFILE_MAP.get(key);
  if (!anchor) return [];

  const results: CompanyPeerEntry[] = [];
  for (const profile of PROFILES) {
    if (normalizeKey(profile.name) === key) continue;
    const score = jaccard(anchor.tags, profile.tags);
    if (score >= 0.25) {
      results.push({
        peerCompany: profile.name,
        similarityScore: Math.round(score * 100),
        peerTags: profile.tags.filter((t) => anchor.tags.includes(t)),
      });
    }
  }

  return results
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 6);
}

/**
 * Returns all companies that have a profile (can generate peers).
 */
export function getAllAnchorCompanies(): string[] {
  return PROFILES.map((p) => p.name);
}
