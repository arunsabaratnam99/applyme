import { classifyJobCategory, classifyEmploymentType, classifyWorkplace } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';

const WAAS_BASE = 'https://www.workatastartup.com';
const WAAS_JOBS_URL = `${WAAS_BASE}/jobs`;
const WAAS_COMPANIES_URL = `${WAAS_BASE}/companies/fetch`;

const JOB_ROLES = [
  'eng',
  'product',
  'data',
  'design',
  'ops',
  'finance',
  'marketing',
  'sales',
];

export async function fetchWorkAtStartupJobs(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  const seen = new Set<string>();

  for (const role of JOB_ROLES) {
    try {
      const url = `${WAAS_JOBS_URL}?role=${role}&remote=true&page=1`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; applyme-job-aggregator/1.0)',
        },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const jobs = parseJobsFromHtml(html, role);

      for (const job of jobs) {
        if (seen.has(job.applyUrl)) continue;
        seen.add(job.applyUrl);

        const jobCategory = classifyJobCategory(job.title, job.descriptionPlain) ?? 'software';

        const canonicalUrlHash = computeCanonicalUrlHash(job.applyUrl);
        const fingerprint = computeFingerprint({
          company: job.company,
          title: job.title,
          location: job.location,
          postedAt: job.postedAt,
        });

        results.push({
          ...job,
          jobCategory,
          canonicalUrlHash,
          fingerprint,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
        });
      }
    } catch (err) {
      console.error(`[workatastartup] error fetching role ${role}:`, err);
    }
  }

  return results;
}

interface RawWaasJob {
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  descriptionPlain: string;
  postedAt: Date | null;
  workplaceType: string | null;
  employmentType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

function parseJobsFromHtml(html: string, role: string): (RawWaasJob & {
  externalId: string;
  country: string;
  jobUrl: string;
  applyType: 'url' | 'email';
  applyEmail: null;
})[] {
  const results: (RawWaasJob & {
    externalId: string;
    country: string;
    jobUrl: string;
    applyType: 'url' | 'email';
    applyEmail: null;
  })[] = [];

  // Extract JSON-LD job postings embedded in the page
  const jsonLdMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1] ?? '');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] !== 'JobPosting') continue;
        const job = extractFromJsonLd(item);
        if (job) results.push(job);
      }
    } catch {
      // ignore malformed JSON
    }
  }

  // Fallback: parse job card HTML if no JSON-LD found
  if (results.length === 0) {
    const cardMatches = html.matchAll(/<div[^>]+class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
    for (const match of cardMatches) {
      const block = match[1] ?? '';
      const titleMatch = block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
      const companyMatch = block.match(/data-company="([^"]+)"/i);
      const linkMatch = block.match(/href="(\/jobs\/\d+[^"]*?)"/i);

      if (!titleMatch || !linkMatch) continue;

      const title = stripTags(titleMatch[1] ?? '');
      const company = companyMatch?.[1] ?? 'YC Company';
      const jobPath = linkMatch[1] ?? '';
      const applyUrl = `${WAAS_BASE}${jobPath}`;
      const externalId = `waas-${jobPath.replace(/\W+/g, '-')}`;

      results.push({
        externalId,
        company,
        title,
        location: 'CA-remote',
        country: 'CA',
        workplaceType: 'remote',
        postedAt: null,
        descriptionPlain: '',
        jobUrl: applyUrl,
        applyUrl,
        applyType: 'url',
        applyEmail: null,
        employmentType: classifyEmploymentType(title),
        salaryMin: null,
        salaryMax: null,
      });
    }
  }

  return results;
}

function extractFromJsonLd(item: Record<string, unknown>): (RawWaasJob & {
  externalId: string;
  country: string;
  jobUrl: string;
  applyType: 'url' | 'email';
  applyEmail: null;
}) | null {
  const title = String(item['title'] ?? '');
  const company = String((item['hiringOrganization'] as Record<string, unknown>)?.['name'] ?? 'YC Company');
  const applyUrl = String(item['url'] ?? item['applicationContact'] ?? '');
  if (!title || !applyUrl) return null;

  const locationRaw = (item['jobLocation'] as Record<string, unknown>)?.['address'] ?? {};
  const locationObj = locationRaw as Record<string, unknown>;
  const city = String(locationObj['addressLocality'] ?? '');
  const region = String(locationObj['addressRegion'] ?? '');
  const country = String(locationObj['addressCountry'] ?? 'US');
  const location = city && region ? `${city}, ${region}` : city || region || 'CA-remote';

  const isRemote = String(item['jobLocationType'] ?? '').toLowerCase().includes('remote');
  const workplaceType = isRemote ? 'remote' : classifyWorkplace(location);

  const postedAt = item['datePosted'] ? new Date(String(item['datePosted'])) : null;
  const descriptionPlain = stripTags(String(item['description'] ?? ''));

  const salarySpec = item['baseSalary'] as Record<string, unknown> | undefined;
  const salaryValue = salarySpec?.['value'] as Record<string, unknown> | undefined;
  const salaryMin = salaryValue?.['minValue'] ? Number(salaryValue['minValue']) : null;
  const salaryMax = salaryValue?.['maxValue'] ? Number(salaryValue['maxValue']) : null;

  const externalId = `waas-${applyUrl.split('/').pop() ?? title}`.slice(0, 100);

  return {
    externalId,
    company,
    title,
    location: isRemote ? 'CA-remote' : normalizeLocation(location),
    country: country === 'CA' || isRemote ? 'CA' : country,
    workplaceType,
    postedAt,
    descriptionPlain,
    jobUrl: applyUrl,
    applyUrl,
    applyType: 'url',
    applyEmail: null,
    employmentType: classifyEmploymentType(title),
    salaryMin,
    salaryMax,
  };
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
