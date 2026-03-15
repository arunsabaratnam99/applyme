import { classifyJobCategory, classifyEmploymentType, classifyWorkplace } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';
import type { RequestBudget } from './linkedin_scraper.js';

const JOB_BANK_BASE = 'https://www.jobbank.gc.ca';
const JOB_BANK_SEARCH = `${JOB_BANK_BASE}/jobsearch/jobsearch`;
const SEARCH_TERMS = ['software developer', 'data analyst', 'software engineer'];

export async function fetchJobBankJobs(budget?: RequestBudget): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  const seen = new Set<string>();

  for (const term of SEARCH_TERMS) {
    if (budget && budget.used >= budget.limit) {
      console.log(`[jobbank] global budget reached (${budget.used}/${budget.limit}), stopping early`);
      break;
    }
    try {
      if (budget) budget.used++;
      const url = `${JOB_BANK_SEARCH}?searchstring=${encodeURIComponent(term)}&locationstring=Canada&sort=M&noe=25&lang=eng&action=search`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-CA,en;q=0.9',
        },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const articles = parseArticles(html);

      for (const item of articles) {
        if (seen.has(item.jobId)) continue;
        seen.add(item.jobId);

        const jobUrl = `${JOB_BANK_BASE}/jobsearch/jobposting/${item.jobId}`;
        const category = classifyJobCategory(item.title, '') ?? 'software';
        const workplaceType = item.telework === 'Telework' ? 'remote' : item.telework === 'Hybrid' ? 'hybrid' : 'onsite';

        const canonicalUrlHash = computeCanonicalUrlHash(jobUrl);
        const fingerprint = computeFingerprint({
          company: item.company,
          title: item.title,
          location: normalizeLocation(item.location),
          postedAt: item.postedAt,
        });

        results.push({
          externalId: `jobbank-${item.jobId}`,
          company: item.company,
          title: item.title,
          location: normalizeLocation(item.location) || 'Canada',
          country: 'CA',
          workplaceType,
          postedAt: item.postedAt,
          descriptionPlain: '',
          jobUrl,
          applyUrl: jobUrl,
          applyType: 'url',
          applyEmail: null,
          jobCategory: category,
          employmentType: classifyEmploymentType(item.title),
          salaryMin: item.salaryMin,
          salaryMax: item.salaryMax,
          canonicalUrlHash,
          fingerprint,
        });
      }
    } catch (err) {
      console.error(`[jobbank] error fetching "${term}":`, err);
    }
  }

  return results;
}

interface JobBankItem {
  jobId: string;
  title: string;
  company: string;
  location: string;
  telework: string;
  postedAt: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
}

function parseArticles(html: string): JobBankItem[] {
  const results: JobBankItem[] = [];
  const articleMatches = html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi);

  for (const match of articleMatches) {
    const block = match[1] ?? '';

    const jobIdMatch = block.match(/jobposting\/(\d+)/);
    if (!jobIdMatch) continue;
    const jobId = jobIdMatch[1]!;

    const titleMatch = block.match(/class="noctitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]!).trim() : '';
    if (!title) continue;

    const companyMatch = block.match(/class="business"[^>]*>\s*([\s\S]*?)\s*<\/li>/i);
    const company = companyMatch ? decodeHtml(stripHtml(companyMatch[1]!).trim()) : 'Job Bank Canada';

    const locationMatch = block.match(/<li class="location">([\s\S]*?)<\/li>/i);
    const location = locationMatch ? stripHtml(locationMatch[1]!).replace(/\bLocation\b/g, '').trim() : 'Canada';

    const teleworkMatch = block.match(/class="telework"[^>]*>([\s\S]*?)<\/span>/i);
    const telework = teleworkMatch ? stripHtml(teleworkMatch[1]!).trim() : 'On site';

    const dateMatch = block.match(/class="date"[^>]*>\s*([\s\S]*?)\s*<\/li>/i);
    const dateStr = dateMatch ? stripHtml(dateMatch[1]!).trim() : '';
    const postedAt = dateStr ? new Date(dateStr) : null;

    const salaryMatch = block.match(/class="salary"[^>]*>[\s\S]*?\$([0-9,]+(?:\.[0-9]+)?)/i);
    const salary2Match = block.match(/\$([0-9,]+(?:\.[0-9]+)?)\s*to\s*\$([0-9,]+(?:\.[0-9]+)?)/i);
    const salaryMin = salary2Match ? parseFloat(salary2Match[1]!.replace(/,/g, '')) : salaryMatch ? parseFloat(salaryMatch[1]!.replace(/,/g, '')) : null;
    const salaryMax = salary2Match ? parseFloat(salary2Match[2]!.replace(/,/g, '')) : null;

    results.push({ jobId, title, company, location, telework, postedAt: postedAt && !isNaN(postedAt.getTime()) ? postedAt : null, salaryMin, salaryMax });
  }

  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
