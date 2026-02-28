import { classifyJobCategory, classifyEmploymentType } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { isCanadianLocation, normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';

export async function fetchLeverJobs(siteSlug: string): Promise<NormalizedJob[]> {
  const url = `https://api.lever.co/v0/postings/${siteSlug}?mode=json&limit=100`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json() as LeverPosting[];
  if (!Array.isArray(data)) return [];

  const results: NormalizedJob[] = [];
  for (const job of data) {
    const location = job.categories?.location ?? job.categories?.allLocations?.[0] ?? '';
    if (!isCanadianLocation(location)) continue;

    const category = classifyJobCategory(job.text, job.descriptionPlain ?? '');
    if (!category) continue;

    const jobUrl = `https://jobs.lever.co/${siteSlug}/${job.id}`;
    const canonicalUrlHash = await computeCanonicalUrlHash(jobUrl);
    const postedAt = job.createdAt ? new Date(job.createdAt) : null;
    const fingerprint = await computeFingerprint({
      company: siteSlug,
      title: job.text,
      location: normalizeLocation(location),
      postedAt,
    });

    results.push({
      externalId: job.id,
      company: siteSlug,
      title: job.text,
      location: normalizeLocation(location),
      country: 'CA',
      workplaceType: job.workplaceType ?? null,
      postedAt,
      descriptionPlain: job.descriptionPlain ?? '',
      jobUrl,
      applyUrl: `${jobUrl}/apply`,
      applyType: 'url',
      applyEmail: null,
      jobCategory: category,
      employmentType: classifyEmploymentType(job.text),
      canonicalUrlHash,
      fingerprint,
    });
  }
  return results;
}

interface LeverPosting {
  id: string;
  text: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    commitment?: string;
  };
  workplaceType?: string;
  descriptionPlain?: string;
  createdAt?: number;
}
