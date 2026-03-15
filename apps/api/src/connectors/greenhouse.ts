import { classifyJobCategory, classifyEmploymentType } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { isCanadianLocation, normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';
import type { RequestBudget } from './linkedin_scraper.js';

export async function fetchGreenhouseJobs(boardToken: string, budget?: RequestBudget): Promise<NormalizedJob[]> {
  if (budget && budget.used >= budget.limit) return [];
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  if (budget) budget.used++;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json() as { jobs?: GreenhouseJob[] };
  if (!data.jobs) return [];

  const results: NormalizedJob[] = [];
  for (const job of data.jobs) {
    const location = job.location?.name ?? '';
    if (!isCanadianLocation(location)) continue;

    const description = stripHtml(job.content ?? '');
    const category = classifyJobCategory(job.title, description);
    if (!category) continue;

    const jobUrl = job.absolute_url;
    const canonicalUrlHash = computeCanonicalUrlHash(jobUrl);
    const postedAt = job.updated_at ? new Date(job.updated_at) : null;
    const fingerprint = computeFingerprint({
      company: boardToken,
      title: job.title,
      location: normalizeLocation(location),
      postedAt,
    });

    results.push({
      externalId: String(job.id),
      company: boardToken,
      title: job.title,
      location: normalizeLocation(location),
      country: 'CA',
      workplaceType: null,
      postedAt,
      descriptionPlain: description,
      jobUrl,
      applyUrl: jobUrl,
      applyType: 'url',
      applyEmail: null,
      jobCategory: category,
      employmentType: classifyEmploymentType(job.title),
      canonicalUrlHash,
      fingerprint,
    });
  }
  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name: string };
  content?: string;
  updated_at?: string;
}
