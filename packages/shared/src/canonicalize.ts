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
 * Encodes a string to a hex SHA-256 digest using the Web Crypto API.
 * Works in CF Workers, browsers, and Node 20+.
 */
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes a SHA-256 hash of a normalized URL.
 * Used as the primary dedup key.
 */
export async function computeCanonicalUrlHash(url: string): Promise<string> {
  return sha256Hex(normalizeUrl(url));
}

/**
 * Computes a content fingerprint from job fields.
 * SHA-256 of: company|title|location|postedDate
 * Used as a secondary dedup key to catch same job posted at different URLs.
 */
export async function computeFingerprint(params: {
  company: string;
  title: string;
  location: string;
  postedAt: Date | null;
}): Promise<string> {
  const { company, title, location, postedAt } = params;
  const input = [
    company.toLowerCase().trim(),
    title.toLowerCase().trim(),
    location.toLowerCase().trim(),
    postedAt ? postedAt.toISOString().slice(0, 10) : '',
  ].join('|');
  return sha256Hex(input);
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
