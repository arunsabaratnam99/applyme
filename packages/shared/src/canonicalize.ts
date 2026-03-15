const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'referer', 'source', 'gh_src', 'lever-source', 'ashby_source',
];

/**
 * Normalizes a URL for deduplication:
 * - Lowercases the URL
 * - Strips tracking query params
 * - Strips trailing slashes
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.toLowerCase().trim());
    TRACKING_PARAMS.forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().trim().replace(/\/$/, '');
  }
}

/**
 * Synchronous FNV-1a 64-bit hash (emulated with two 32-bit halves).
 * Zero async overhead — safe to call per-job in Cloudflare Workers.
 */
function fnv1aHex(input: string): string {
  let hi = 0x811c9dc5 >>> 0;
  let lo = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    lo ^= c;
    lo = Math.imul(lo, 0x01000193) >>> 0;
    hi ^= c;
    hi = Math.imul(hi, 0x01000193) >>> 0;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}

/**
 * Computes a hash of a normalized URL.
 * Used as the primary dedup key.
 */
export function computeCanonicalUrlHash(url: string): string {
  return fnv1aHex(normalizeUrl(url));
}

/**
 * Computes a content fingerprint from job fields.
 * Hash of: company|title|location|postedDate
 * Used as a secondary dedup key to catch same job posted at different URLs.
 */
export function computeFingerprint(params: {
  company: string;
  title: string;
  location: string;
  postedAt: Date | null;
}): string {
  const { company, title, location, postedAt } = params;
  const input = [
    company.toLowerCase().trim(),
    title.toLowerCase().trim(),
    location.toLowerCase().trim(),
    postedAt ? postedAt.toISOString().slice(0, 10) : '',
  ].join('|');
  return fnv1aHex(input);
}

/**
 * Canonicalizes a company name for matching/deduplication.
 * Strips legal suffixes, normalizes case and whitespace.
 */
export function canonicalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/,?\s+(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|limited|incorporated)$/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
