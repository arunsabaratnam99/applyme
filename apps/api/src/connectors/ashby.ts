import { classifyJobCategory, classifyEmploymentType } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { isCanadianLocation, normalizeLocation } from '@applyme/shared/utils';
import type { RequestBudget } from './linkedin_scraper.js';

export interface NormalizedJob {
  externalId: string;
  company: string;
  title: string;
  location: string;
  country: string;
  workplaceType: string | null;
  postedAt: Date | null;
  descriptionPlain: string;
  jobUrl: string;
  applyUrl: string;
  applyType: 'url' | 'email';
  applyEmail: string | null;
  jobCategory: string;
  employmentType: string;
  canonicalUrlHash: string;
  fingerprint: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

export async function fetchAshbyJobs(boardSlug: string, budget?: RequestBudget): Promise<NormalizedJob[]> {
  if (budget && budget.used >= budget.limit) return [];
  const url = `https://api.ashbyhq.com/posting-public/apiKey/${boardSlug}/jobs`;
  if (budget) budget.used++;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json() as { jobs?: AshbyJob[] };
  if (!data.jobs) return [];

  const results: NormalizedJob[] = [];
  for (const job of data.jobs) {
    const location = job.location ?? job.isRemote ? 'CA-remote' : '';
    if (!isCanadianLocation(location) && !job.isRemote) continue;

    const category = classifyJobCategory(job.title, job.descriptionPlain ?? '');
    if (!category) continue;

    const jobUrl = `https://jobs.ashbyhq.com/${boardSlug}/${job.id}`;
    const canonicalUrlHash = computeCanonicalUrlHash(jobUrl);
    const fingerprint = computeFingerprint({
      company: boardSlug,
      title: job.title,
      location: normalizeLocation(location),
      postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    });

    results.push({
      externalId: job.id,
      company: job.departmentName ?? boardSlug,
      title: job.title,
      location: normalizeLocation(location),
      country: 'CA',
      workplaceType: job.isRemote ? 'remote' : 'onsite',
      postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
      descriptionPlain: job.descriptionPlain ?? '',
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

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  isRemote: boolean;
  departmentName?: string;
  descriptionPlain?: string;
  publishedAt?: string;
}
