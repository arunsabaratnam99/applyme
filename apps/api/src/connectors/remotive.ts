import { classifyJobCategory, classifyEmploymentType, classifyWorkplace } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';
import type { RequestBudget } from './linkedin_scraper.js';

const REMOTIVE_API = 'https://remotive.com/api/remote-jobs';

const RELEVANT_CATEGORIES = [
  'software-dev',
  'devops-sysadmin',
  'data',
  'product',
  'backend',
  'frontend',
];

export async function fetchRemotiveJobs(budget?: RequestBudget): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];

  for (const category of RELEVANT_CATEGORIES) {
    if (budget && budget.used >= budget.limit) {
      console.log(`[remotive] global budget reached (${budget.used}/${budget.limit}), stopping early`);
      break;
    }
    try {
      if (budget) budget.used++;
      const url = `${REMOTIVE_API}?category=${encodeURIComponent(category)}&limit=100`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'applyme-job-aggregator/1.0' },
      });
      if (!res.ok) continue;

      const data = await res.json() as { jobs?: RemotiveJob[] };
      if (!data.jobs) continue;

      for (const job of data.jobs) {
        const jobCategory = classifyJobCategory(job.title, job.description ?? '') ?? 'software';

        const applyUrl = job.url;
        const canonicalUrlHash = computeCanonicalUrlHash(applyUrl);
        const fingerprint = computeFingerprint({
          company: job.company_name,
          title: job.title,
          location: 'CA-remote',
          postedAt: job.publication_date ? new Date(job.publication_date) : null,
        });

        results.push({
          externalId: String(job.id),
          company: job.company_name,
          title: job.title,
          location: 'CA-remote',
          country: 'CA',
          workplaceType: 'remote',
          postedAt: job.publication_date ? new Date(job.publication_date) : null,
          descriptionPlain: stripHtml(job.description ?? ''),
          jobUrl: applyUrl,
          applyUrl,
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
      console.error(`[remotive] error fetching category ${category}:`, err);
    }
  }

  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  description: string;
  publication_date: string;
  job_type: string;
  salary: string;
  candidate_required_location: string;
  tags: string[];
}
