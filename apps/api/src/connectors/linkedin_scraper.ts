import { classifyJobCategory, classifyEmploymentType, classifyWorkplace, isInternshipOrCoOp } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';

// LinkedIn guest jobs API — publicly accessible, no auth required.
// Same data Google Jobs indexes. Returns HTML job card fragments.
const LI_GUEST_API = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const LI_POSTING_API = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';

// Resolve the external ATS apply URL from a LinkedIn job ID using the jobPosting API.
// Returns the resolved URL or null if not found / not an offsite application.
async function resolveApplyUrlFromPosting(jobId: string): Promise<string | null> {
  try {
    const res = await fetch(`${LI_POSTING_API}/${jobId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // PRIMARY: <code id="applyUrl"><!--"https://...externalApply/...?url=ENCODED_ATS_URL"--></code>
    const codeTagMatch = html.match(/<code[^>]*id="applyUrl"[^>]*><!--"([^"]+)"--><\/code>/i);
    if (codeTagMatch?.[1]) {
      const rawHref = codeTagMatch[1].replace(/&amp;/g, '&');
      const urlParam = new URL(rawHref).searchParams.get('url');
      if (urlParam) {
        const atsUrl = decodeURIComponent(urlParam);
        if (!atsUrl.includes('linkedin.com') && atsUrl.startsWith('http')) return atsUrl;
      }
      if (!rawHref.includes('linkedin.com') && rawHref.startsWith('http')) return rawHref;
    }

    // FALLBACK patterns
    const patterns = [
      /"applyUrl"\s*:\s*"(https?:\/\/[^"]+)"/,
      /"apply_url"\s*:\s*"(https?:\/\/[^"]+)"/,
      /data-tracking-control-name="public_jobs_apply-link-offsite"[^>]*href="([^"]+)"/i,
      /href="([^"]+)"[^>]*data-tracking-control-name="public_jobs_apply-link-offsite"/i,
      /href="(https?:\/\/(?:[^"]*\.(?:greenhouse|lever|workday|ashbyhq|taleo|icims|jobvite|smartrecruiters|bamboohr|recruitee|dover|rippling)[^"]*))"/i,
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m?.[1]) {
        const url = decodeURIComponent(m[1].replace(/&amp;/g, '&').replace(/\\/g, ''));
        if (!url.includes('linkedin.com') && url.startsWith('http')) return url;
      }
    }
    return null;
  } catch {
    return null;
  }
}

type QueryCategory = 'software' | 'business';

// Hard cap — must stay at or below budget.limit (45) since each query = 1 subrequest.
// Keep at 20 max to leave headroom for other connectors sharing the same budget.
export const MAX_QUERIES = 22;

type SearchQuery = { keywords: string; location: string; jobType: string; defaultCategory: QueryCategory };

export const SEARCH_QUERIES: SearchQuery[] = ([
  // ── Full-time Canada — software (10) ────────────────────────────────────────
  { keywords: 'software engineer',          location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'software developer',         location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'backend developer',          location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'frontend developer',         location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'data engineer',              location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'machine learning engineer',  location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'devops engineer',            location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'cloud engineer',             location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'business analyst',           location: 'Canada', jobType: '', defaultCategory: 'business' },
  { keywords: 'product manager',            location: 'Canada', jobType: '', defaultCategory: 'software' },
  // ── Intern / co-op Canada (10) ──────────────────────────────────────────────
  { keywords: 'software engineering intern', location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'software developer intern',   location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'co-op software engineer',     location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'backend intern',              location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'frontend intern',             location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'data science intern',         location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'developer co-op',             location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'fall 2026 co-op',             location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'summer 2026 intern',          location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'new grad software engineer',  location: 'Canada', jobType: '', defaultCategory: 'software' },
  { keywords: 'intern',                      location: 'Canada', jobType: 'I', defaultCategory: 'software' },
  { keywords: 'co-op',                       location: 'Canada', jobType: 'I', defaultCategory: 'software' },
] as SearchQuery[]).slice(0, MAX_QUERIES);

const PAGES_PER_QUERY = 1;
const INTERN_PAGES_PER_QUERY = 1;
const PAGE_SIZE = 25;
const DELAY_MS = 300;

export interface RequestBudget { used: number; limit: number; }

export async function fetchLinkedInJobs(budget: RequestBudget): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  const seen = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    if (budget.used >= budget.limit) {
      console.log(`[linkedin] global subrequest budget reached (${budget.used}/${budget.limit}), stopping early`);
      break;
    }
    const maxPages = query.jobType ? INTERN_PAGES_PER_QUERY : PAGES_PER_QUERY;
    for (let page = 0; page < maxPages; page++) {
      if (budget.used >= budget.limit) break;
      try {
        const start = page * PAGE_SIZE;
        const params = new URLSearchParams({
          keywords: query.keywords,
          location: query.location,
          f_TPR: query.jobType ? 'r2592000' : 'r604800',
          start: String(start),
        });
        if (query.jobType) params.set('f_JT', query.jobType);

        const url = `${LI_GUEST_API}?${params.toString()}`;
        budget.used++;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.linkedin.com/',
          },
        });

        if (!res.ok) {
          if (res.status === 429) {
            await sleep(5000);
            break;
          }
          continue;
        }

        const html = await res.text();
        const jobs = parseLinkedInJobCards(html);

        for (const job of jobs) {
          if (seen.has(job.jobUrl)) continue;
          seen.add(job.jobUrl);

          const jobCategory = classifyJobCategory(job.title, job.descriptionPlain) ?? query.defaultCategory;

          const canonicalUrlHash = computeCanonicalUrlHash(job.jobUrl);
          const fingerprint = computeFingerprint({
            company: job.company,
            title: job.title,
            location: job.location,
            postedAt: job.postedAt,
          });

          // Attempt to resolve the external ATS apply URL from the jobPosting API.
          // Only consume a budget slot when there is headroom (keep ≥5 slots free).
          let resolvedApplyUrl = job.applyUrl;
          const jobIdForResolve = job.externalId.replace(/^li-/, '');
          if (jobIdForResolve && budget.used < budget.limit - 5) {
            budget.used++;
            const atsUrl = await resolveApplyUrlFromPosting(jobIdForResolve);
            if (atsUrl) resolvedApplyUrl = atsUrl;
          }

          results.push({
            externalId: job.externalId,
            company: job.company,
            title: job.title,
            location: job.location,
            country: job.country,
            workplaceType: job.workplaceType,
            postedAt: job.postedAt,
            descriptionPlain: job.descriptionPlain,
            jobUrl: job.jobUrl,
            applyUrl: resolvedApplyUrl,
            applyType: 'url',
            applyEmail: null,
            jobCategory,
            employmentType: classifyEmploymentType(job.title),
            canonicalUrlHash,
            fingerprint,
            salaryMin: job.salaryMin ?? null,
            salaryMax: job.salaryMax ?? null,
          });
        }

        await sleep(DELAY_MS);
      } catch (err) {
        console.error(`[linkedin] error fetching "${query.keywords}" page ${page}:`, err);
      }
    }
  }

  return results;
}

interface RawLinkedInCard {
  externalId: string;
  title: string;
  company: string;
  location: string;
  country: string;
  workplaceType: string | null;
  postedAt: Date | null;
  descriptionPlain: string;
  jobUrl: string;
  applyUrl: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

function parseLinkedInJobCards(html: string): RawLinkedInCard[] {
  const results: RawLinkedInCard[] = [];

  // LinkedIn guest API returns <li> elements, each containing a job card
  const liMatches = html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);

  for (const match of liMatches) {
    const block = match[1] ?? '';

    // Job ID from data-entity-urn or job URL
    const urnMatch = block.match(/data-entity-urn="[^"]*:(\d+)"/i);
    const urlMatch = block.match(/href="https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]*?(\d+)[^"]*"/i);
    const jobId = urnMatch?.[1] ?? urlMatch?.[1] ?? '';
    if (!jobId) continue;

    const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;

    // Title
    const titleMatch = block.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)
      ?? block.match(/aria-label="([^"]+)"/i);
    const title = titleMatch ? stripTags(titleMatch[1] ?? '') : '';
    if (!title) continue;

    // Company
    const companyMatch = block.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i);
    const company = companyMatch ? stripTags(companyMatch[1] ?? '') : 'Unknown';

    // Location
    const locationMatch = block.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const locationRaw = locationMatch ? stripTags(locationMatch[1] ?? '') : '';
    const location = normalizeLocation(locationRaw) || 'CA-remote';
    const country = inferCountry(locationRaw);

    // Workplace type
    const workplaceMatch = block.match(/<span[^>]*class="[^"]*work-type[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
      ?? block.match(/<span[^>]*>(\bRemote\b|\bHybrid\b|\bOn-site\b)<\/span>/i);
    const workplaceType = workplaceMatch ? classifyWorkplace(workplaceMatch[1] ?? '') : classifyWorkplace(locationRaw);

    // Posted date
    const timeMatch = block.match(/<time[^>]+datetime="([^"]+)"/i);
    const postedAt = timeMatch?.[1] ? new Date(timeMatch[1]) : null;

    // Salary (sometimes appears in card metadata)
    const salaryMatch = block.match(/\$(\d[\d,]*)\s*[-–]\s*\$(\d[\d,]*)/);
    const salaryMin = salaryMatch ? parseInt(salaryMatch[1]!.replace(/,/g, ''), 10) : null;
    const salaryMax = salaryMatch ? parseInt(salaryMatch[2]!.replace(/,/g, ''), 10) : null;

    results.push({
      externalId: `li-${jobId}`,
      title,
      company,
      location,
      country,
      workplaceType,
      postedAt,
      descriptionPlain: '',
      jobUrl,
      applyUrl: jobUrl,
      salaryMin,
      salaryMax,
    });
  }

  return results;
}

function inferCountry(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes('canada') || lower.includes(', on') || lower.includes(', bc') || lower.includes(', ab') || lower.includes(', qc')) return 'CA';
  if (lower.includes('united states') || lower.includes(', ny') || lower.includes(', ca') || lower.includes(', tx')) return 'US';
  if (lower.includes('remote')) return 'CA';
  return 'US';
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
