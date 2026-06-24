import { classifyJobCategory, classifyEmploymentType } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';

const BRANCH_FALLBACKS = ['dev', 'main', 'master'];

export interface GithubRepoConfig {
  owner: string;
  repo: string;
  isInternship: boolean;
}

// Built-in / default repos. Stale historical repos are excluded to keep job
// count manageable. Users can extend this list via the `internship_sources`
// table (see fetchGithubRepoJobs signature below).
export const DEFAULT_GITHUB_REPOS: GithubRepoConfig[] = [
  { owner: 'SimplifyJobs', repo: 'Summer2026-Internships',         isInternship: true },
  { owner: 'vanshb03',     repo: 'Summer2027-Internships',         isInternship: true },
  { owner: 'speedyapply',  repo: '2026-SWE-College-Jobs',          isInternship: true },
  { owner: 'speedyapply',  repo: '2026-AI-College-Jobs',           isInternship: true },
  { owner: 'jenndryden',   repo: 'Canadian-Tech-Internships',      isInternship: true },
  { owner: 'skillsire',    repo: 'Internship-and-Co-op-Jobs',      isInternship: true },
  { owner: 'negarprh',     repo: 'Canadian-Tech-Internships-2026', isInternship: true },
];

const MAX_JOB_AGE_DAYS = 60;
const MAX_JOBS_PER_TICK = 300;

interface GithubListing {
  id?: string;
  company_name?: string;
  title?: string;
  url?: string;
  locations?: string[];
  date_posted?: number;
  active?: boolean;
  is_visible?: boolean;
  category?: string;
}

export async function fetchGithubRepoJobs(
  repos: GithubRepoConfig[] = DEFAULT_GITHUB_REPOS,
): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  const seen = new Set<string>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_JOB_AGE_DAYS);

  // Dedup the (owner, repo) pairs while preserving order so duplicate user
  // entries don't cost us extra HTTP round-trips.
  const uniqueRepos: GithubRepoConfig[] = [];
  const seenRepoKeys = new Set<string>();
  for (const r of repos) {
    const key = `${r.owner.toLowerCase()}/${r.repo.toLowerCase()}`;
    if (seenRepoKeys.has(key)) continue;
    seenRepoKeys.add(key);
    uniqueRepos.push(r);
  }

  for (const { owner, repo, isInternship } of uniqueRepos) {
    if (results.length >= MAX_JOBS_PER_TICK) break;

    const sourceRepo = `${owner}/${repo}`;

    const listings = await fetchListingsJson(owner, repo);
    if (listings) {
      const jobs = parseListingsJson(listings, repo, sourceRepo, isInternship, seen, cutoff);
      console.log(`[github] ${owner}/${repo}: ${jobs.length} jobs (listings.json)`);
      results.push(...jobs);
      continue;
    }

    const readme = await fetchReadme(owner, repo);
    if (!readme) continue;

    const jobs = parseHtmlTable(readme, repo, sourceRepo, isInternship, seen, cutoff);
    console.log(`[github] ${owner}/${repo}: ${jobs.length} jobs (README.md)`);
    results.push(...jobs);
  }

  return results.slice(0, MAX_JOBS_PER_TICK);
}

async function fetchRawFile(owner: string, repo: string, path: string): Promise<string | null> {
  for (const branch of BRANCH_FALLBACKS) {
    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'applyme-job-aggregator/1.0' },
      });
      if (res.ok) return await res.text();
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchListingsJson(owner: string, repo: string): Promise<GithubListing[] | null> {
  const content = await fetchRawFile(owner, repo, '.github/scripts/listings.json');
  if (!content) return null;

  try {
    const data = JSON.parse(content) as unknown;
    return Array.isArray(data) ? data : null;
  } catch {
    console.warn(`[github] ${owner}/${repo}: invalid listings.json`);
    return null;
  }
}

async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  return fetchRawFile(owner, repo, 'README.md');
}

function parseListingsJson(
  listings: GithubListing[],
  repoName: string,
  sourceRepo: string,
  isInternship: boolean,
  seen: Set<string>,
  cutoff?: Date,
): NormalizedJob[] {
  const results: NormalizedJob[] = [];

  for (const listing of listings) {
    if (!listing.active || !listing.is_visible) continue;

    const cleanCompany = listing.company_name?.trim() ?? '';
    const cleanTitle = listing.title?.trim() ?? '';
    const applyUrl = listing.url?.trim() ?? '';
    if (!cleanCompany || !cleanTitle || !applyUrl) continue;

    if (applyUrl.includes('simplify.jobs/install') || applyUrl.includes('simplify.jobs/c/')) continue;
    if (seen.has(applyUrl)) continue;
    seen.add(applyUrl);

    const locationRaw = (listing.locations ?? []).filter(Boolean).join(', ');
    const postedAt = listing.date_posted ? new Date(listing.date_posted * 1000) : null;
    if (cutoff && postedAt && postedAt < cutoff) continue;

    results.push(
      buildNormalizedJob({
        repoName,
        sourceRepo,
        isInternship,
        cleanCompany,
        cleanTitle,
        locationRaw,
        applyUrl,
        postedAt,
        ...(listing.id ? { listingId: listing.id } : {}),
        ...(listing.category ? { categoryHint: listing.category } : {}),
      }),
    );
  }

  return results;
}

function parseHtmlTable(
  content: string,
  repoName: string,
  sourceRepo: string,
  isInternship: boolean,
  seen: Set<string>,
  cutoff?: Date,
): NormalizedJob[] {
  const results: NormalizedJob[] = [];

  const rowMatches = content.matchAll(/<tr>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const row = rowMatch[1] ?? '';

    if (/<th[\s>]/i.test(row)) continue;

    const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length < 3) continue;

    const companyCell = cellMatches[0]?.[1] ?? '';
    const titleCell = cellMatches[1]?.[1] ?? '';
    const locationCell = cellMatches[2]?.[1] ?? '';
    const applyCell = cellMatches[3]?.[1] ?? '';
    const ageCell = cellMatches[4]?.[1] ?? '';

    const cleanCompany = stripTags(companyCell).replace(/[🔥⭐]/g, '').trim();
    const cleanTitle = stripTags(titleCell).trim();
    const locationRaw = stripTags(locationCell).trim();

    if (!cleanCompany || !cleanTitle) continue;
    if (cleanCompany.startsWith('↳')) continue;
    if (applyCell.toLowerCase().includes('closed') || applyCell.trim() === '🔒') continue;

    const urlMatch = applyCell.match(/href="(https?:\/\/[^"]+)"/i);
    const applyUrl = urlMatch?.[1] ?? '';
    if (!applyUrl) continue;
    if (applyUrl.includes('simplify.jobs/install') || applyUrl.includes('simplify.jobs/c/')) continue;

    if (seen.has(applyUrl)) continue;
    seen.add(applyUrl);

    const postedAt = parseAgeCell(ageCell);
    if (cutoff && postedAt && postedAt < cutoff) continue;

    results.push(
      buildNormalizedJob({
        repoName,
        sourceRepo,
        isInternship,
        cleanCompany,
        cleanTitle,
        locationRaw,
        applyUrl,
        postedAt,
      }),
    );
  }

  return results;
}

function buildNormalizedJob(params: {
  repoName: string;
  sourceRepo: string;
  isInternship: boolean;
  cleanCompany: string;
  cleanTitle: string;
  locationRaw: string;
  applyUrl: string;
  postedAt: Date | null;
  listingId?: string;
  categoryHint?: string;
}): NormalizedJob {
  const { repoName, sourceRepo, isInternship, cleanCompany, cleanTitle, locationRaw, applyUrl, postedAt, listingId, categoryHint } =
    params;

  const isRemote = locationRaw.toLowerCase().includes('remote');
  const locationLower = locationRaw.toLowerCase();
  const country =
    locationLower.includes('canada') || /\b(on|bc|ab|qc|mb|sk|ns|nb|nl|pe)\b/i.test(locationRaw)
      ? 'CA'
      : locationLower.includes('united kingdom') || locationLower.includes(' uk')
        ? 'GB'
        : 'US';

  const category =
    classifyJobCategory(cleanTitle, categoryHint ?? '') ??
    mapListingCategory(categoryHint) ??
    'software';

  const externalId = listingId
    ? `${repoName}-${listingId}`.slice(0, 100)
    : `${repoName}-${cleanCompany}-${cleanTitle}`.replace(/\s+/g, '-').toLowerCase().slice(0, 100);

  const titleEmploymentType = classifyEmploymentType(cleanTitle);
  const titleHasInternSignal =
    /\bintern(ship)?\b|\bco-?op\b|\bwork term\b|\bstudent\b|\bplacement\b|\bpracticum\b|\btrainee\b/i.test(
      cleanTitle,
    );
  const employmentType = titleHasInternSignal
    ? titleEmploymentType
    : isInternship
      ? 'internship'
      : titleEmploymentType;

  return {
    externalId,
    company: cleanCompany,
    title: cleanTitle,
    location: normalizeLocation(locationRaw) || (isRemote ? 'Remote' : locationRaw || 'United States'),
    country,
    workplaceType: isRemote ? 'remote' : null,
    postedAt,
    descriptionPlain: '',
    jobUrl: applyUrl,
    applyUrl,
    applyType: 'url',
    applyEmail: null,
    jobCategory: category,
    employmentType,
    canonicalUrlHash: computeCanonicalUrlHash(applyUrl),
    fingerprint: computeFingerprint({
      company: cleanCompany,
      title: cleanTitle,
      location: locationRaw,
      postedAt,
    }),
    salaryMin: null,
    salaryMax: null,
    sourceRepo,
  };
}

function mapListingCategory(category?: string): string | null {
  if (!category) return null;
  const lower = category.toLowerCase();
  if (lower.includes('software') || lower.includes('ai') || lower.includes('data')) return 'software';
  if (lower.includes('product')) return 'business';
  return null;
}

function parseAgeCell(cell: string): Date | null {
  if (!cell) return null;
  const text = stripTags(cell).replace(/\*\*/g, '').trim();
  if (!text) return null;

  const daysAgo = text.match(/^(\d+)\s*d$/i);
  if (daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(daysAgo[1]!, 10));
    return d;
  }

  const hoursAgo = text.match(/^(\d+)\s*h$/i);
  if (hoursAgo) {
    const d = new Date();
    d.setHours(d.getHours() - parseInt(hoursAgo[1]!, 10));
    return d;
  }

  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function stripTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
