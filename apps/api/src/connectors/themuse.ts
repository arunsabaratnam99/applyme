import { classifyJobCategory, classifyEmploymentType, classifyWorkplace } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';
import type { RequestBudget } from './linkedin_scraper.js';

// The Muse public API — no auth required for basic access.
const MUSE_API = 'https://www.themuse.com/api/public/jobs';

const CATEGORIES = [
  'Software Engineer',
  'Data Science',
  'Product Management',
];

export async function fetchTheMuseJobs(budget?: RequestBudget): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  const seen = new Set<string>();

  for (const category of CATEGORIES) {
    if (budget && budget.used >= budget.limit) {
      console.log(`[themuse] global budget reached (${budget.used}/${budget.limit}), stopping early`);
      break;
    }
    try {
      if (budget) budget.used++;
      const params = new URLSearchParams({ category, page: '0', descending: 'true' });
      const res = await fetch(`${MUSE_API}?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) continue;

      const data = await res.json() as { results?: MuseJob[] };
      if (!data.results) continue;

      for (const job of data.results) {
        const applyUrl = job.refs?.landing_page ?? '';
        if (!applyUrl || seen.has(applyUrl)) continue;
        seen.add(applyUrl);

        const location = job.locations?.[0]?.name ?? 'Remote';
        const isRemote = location.toLowerCase().includes('remote') || job.locations?.length === 0;

        const jobCategory = classifyJobCategory(job.name, '') ?? 'software';
        const canonicalUrlHash = computeCanonicalUrlHash(applyUrl);
        const fingerprint = computeFingerprint({
          company: job.company?.name ?? 'Unknown',
          title: job.name,
          location: normalizeLocation(location),
          postedAt: job.publication_date ? new Date(job.publication_date) : null,
        });

        results.push({
          externalId: `muse-${job.id}`,
          company: job.company?.name ?? 'Unknown',
          title: job.name,
          location: isRemote ? 'CA-remote' : normalizeLocation(location),
          country: isRemote ? 'CA' : 'US',
          workplaceType: isRemote ? 'remote' : classifyWorkplace(location),
          postedAt: job.publication_date ? new Date(job.publication_date) : null,
          descriptionPlain: '',
          jobUrl: applyUrl,
          applyUrl,
          applyType: 'url',
          applyEmail: null,
          jobCategory,
          employmentType: classifyEmploymentType(job.name),
          canonicalUrlHash,
          fingerprint,
          salaryMin: null,
          salaryMax: null,
        });
      }
    } catch (err) {
      console.error(`[themuse] error fetching category ${category}:`, err);
    }
  }

  console.log(`[themuse] fetched ${results.length} jobs`);
  return results;
}

interface MuseJob {
  id: number;
  name: string;
  publication_date?: string;
  locations?: Array<{ name: string }>;
  company?: { name: string };
  refs?: { landing_page?: string };
}
