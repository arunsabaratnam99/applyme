import { classifyJobCategory, classifyEmploymentType, classifyWorkplace } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';
import type { Env } from '../types.js';

// ─── JSearch API (RapidAPI) — replaces blocked Indeed HTML scraper ────────────
// Free tier: 200 req/month. Sign up at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
// Add RAPIDAPI_KEY to apps/api/.dev.vars and Cloudflare Worker secrets.
const JSEARCH_URL = 'https://jsearch.p.rapidapi.com/search';
const JSEARCH_HOST = 'jsearch.p.rapidapi.com';

type QueryCategory = 'software' | 'business';

const SEARCH_QUERIES: { q: string; country: string; defaultCategory: QueryCategory; datePosted: string }[] = [
  { q: 'software engineer Canada',       country: 'CA', defaultCategory: 'software', datePosted: 'week' },
  { q: 'data engineer Canada',            country: 'CA', defaultCategory: 'software', datePosted: 'week' },
  { q: 'frontend developer Canada',       country: 'CA', defaultCategory: 'software', datePosted: 'week' },
  { q: 'backend developer Canada',        country: 'CA', defaultCategory: 'software', datePosted: 'week' },
  { q: 'devops engineer Canada',          country: 'CA', defaultCategory: 'software', datePosted: 'week' },
  { q: 'machine learning engineer Canada',country: 'CA', defaultCategory: 'software', datePosted: 'week' },
  { q: 'business analyst Canada',         country: 'CA', defaultCategory: 'business', datePosted: 'week' },
  { q: 'software engineer remote',        country: 'US', defaultCategory: 'software', datePosted: 'week' },
  { q: 'software intern Canada',          country: 'CA', defaultCategory: 'software', datePosted: 'month' },
  { q: 'co-op software developer Canada', country: 'CA', defaultCategory: 'software', datePosted: 'month' },
  { q: 'software intern United States',   country: 'US', defaultCategory: 'software', datePosted: 'month' },
  { q: 'intern Canada',                   country: 'CA', defaultCategory: 'software', datePosted: 'month' },
  { q: 'co-op Canada',                    country: 'CA', defaultCategory: 'software', datePosted: 'month' },
];

const RESULTS_PER_QUERY = 10;

export async function fetchIndeedJobs(env: Env): Promise<NormalizedJob[]> {
  const apiKey = env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn('[indeed] RAPIDAPI_KEY not set — skipping JSearch fetch');
    return [];
  }

  const results: NormalizedJob[] = [];
  const seen = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    try {
      const params = new URLSearchParams({
        query: query.q,
        num_pages: '1',
        date_posted: query.datePosted,
        results_per_page: String(RESULTS_PER_QUERY),
      });

      const res = await fetch(`${JSEARCH_URL}?${params}`, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': JSEARCH_HOST,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`[indeed/jsearch] HTTP ${res.status} for "${query.q}"`);
        continue;
      }

      const json = await res.json() as JSearchResponse;
      const jobs = json.data ?? [];

      for (const job of jobs) {
        const jobUrl = job.job_apply_link ?? job.job_google_link ?? '';
        if (!jobUrl) continue;
        if (seen.has(jobUrl)) continue;
        seen.add(jobUrl);

        const title = job.job_title ?? '';
        const company = job.employer_name ?? 'Unknown';
        const city = job.job_city ?? '';
        const state = job.job_state ?? '';
        const countryCode = job.job_country?.toUpperCase() === 'CANADA' ? 'CA'
          : job.job_country?.toUpperCase() === 'US' || job.job_country?.toUpperCase() === 'USA' ? 'US'
          : query.country;
        const locationRaw = [city, state].filter(Boolean).join(', ');
        const isRemote = job.job_is_remote ?? locationRaw.toLowerCase().includes('remote');
        const workplaceType = isRemote ? 'remote' : classifyWorkplace(locationRaw);
        const location = normalizeLocation(locationRaw) || (isRemote ? 'Remote' : countryCode === 'CA' ? 'Canada' : 'United States');

        const postedAt = job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : null;
        const descriptionPlain = job.job_description ?? '';

        const salaryMin = job.job_min_salary ?? null;
        const salaryMax = job.job_max_salary ?? null;

        const externalId = `indeed-${simpleHash(jobUrl)}`;
        const jobCategory = classifyJobCategory(title, descriptionPlain) ?? query.defaultCategory;

        const canonicalUrlHash = computeCanonicalUrlHash(jobUrl);
        const fingerprint = computeFingerprint({
          company,
          title,
          location,
          postedAt,
        });

        results.push({
          externalId,
          company,
          title,
          location,
          country: countryCode,
          workplaceType,
          postedAt,
          descriptionPlain,
          jobUrl,
          applyUrl: jobUrl,
          applyType: 'url',
          applyEmail: null,
          jobCategory,
          employmentType: classifyEmploymentType(title),
          canonicalUrlHash,
          fingerprint,
          salaryMin,
          salaryMax,
        });
      }
    } catch (err) {
      console.error(`[indeed/jsearch] error for "${query.q}":`, err);
    }
  }

  console.log(`[indeed/jsearch] fetched ${results.length} jobs`);
  return results;
}

// ─── JSearch API response types ───────────────────────────────────────────────

interface JSearchResponse {
  data?: JSearchJob[];
}

interface JSearchJob {
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string;
  job_description?: string;
  job_apply_link?: string;
  job_google_link?: string;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
