import { classifyJobCategory, classifyEmploymentType, classifyWorkplace } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';
import type { RequestBudget } from './linkedin_scraper.js';

// Arbeitnow free public API — no auth required.
// Returns remote-friendly and worldwide tech jobs.
const ARBEITNOW_API = 'https://www.arbeitnow.com/api/job-board-api';

export async function fetchArbeitnowJobs(budget?: RequestBudget): Promise<NormalizedJob[]> {
  if (budget && budget.used >= budget.limit) return [];

  const results: NormalizedJob[] = [];
  const seen = new Set<string>();

  try {
    if (budget) budget.used++;
    const res = await fetch(`${ARBEITNOW_API}?page=1`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];

    const data = await res.json() as { data?: ArbeitnowJob[] };
    if (!data.data) return [];

    for (const job of data.data) {
      if (!job.remote && !job.location?.toLowerCase().includes('canada')) continue;
      if (seen.has(job.url)) continue;
      seen.add(job.url);

      const jobCategory = classifyJobCategory(job.title, job.description ?? '') ?? 'software';
      const canonicalUrlHash = computeCanonicalUrlHash(job.url);
      const fingerprint = computeFingerprint({
        company: job.company_name,
        title: job.title,
        location: job.remote ? 'CA-remote' : normalizeLocation(job.location ?? ''),
        postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
      });

      results.push({
        externalId: `arbeitnow-${job.slug}`,
        company: job.company_name,
        title: job.title,
        location: job.remote ? 'CA-remote' : normalizeLocation(job.location ?? ''),
        country: job.remote ? 'CA' : 'US',
        workplaceType: job.remote ? 'remote' : classifyWorkplace(job.location ?? ''),
        postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
        descriptionPlain: stripHtml(job.description ?? ''),
        jobUrl: job.url,
        applyUrl: job.url,
        applyType: 'url',
        applyEmail: null,
        jobCategory,
        employmentType: classifyEmploymentType(job.title),
        canonicalUrlHash,
        fingerprint,
        salaryMin: null,
        salaryMax: null,
      });
    }
  } catch (err) {
    console.error('[arbeitnow] error fetching jobs:', err);
  }

  console.log(`[arbeitnow] fetched ${results.length} jobs`);
  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface ArbeitnowJob {
  slug: string;
  title: string;
  company_name: string;
  location?: string;
  remote: boolean;
  url: string;
  description?: string;
  created_at?: number;
}
