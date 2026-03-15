import { classifyJobCategory, classifyEmploymentType, isInternshipOrCoOp } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';

// Branches to try in order when fetching README.md
const BRANCH_FALLBACKS = ['dev', 'main', 'master'];

// Only 2026/active repos — stale historical repos are excluded to keep job count manageable
const GITHUB_REPOS = [
  { owner: 'SimplifyJobs', repo: 'Summer2026-Internships', isInternship: true },
  { owner: 'SimplifyJobs', repo: 'New-Grad-Positions', isInternship: false },
  { owner: 'Ouckah', repo: 'Summer2026-Internships', isInternship: true },
  { owner: 'cvrve', repo: 'New-Grad-2026', isInternship: false },
  { owner: 'vanshb03', repo: 'Summer2026-Internships', isInternship: true },
];

// Only ingest jobs posted within this window — keeps the set fresh and manageable
const MAX_JOB_AGE_DAYS = 60;
// Hard cap per tick to prevent CPU overrun on first run
const MAX_JOBS_PER_TICK = 300;

export async function fetchGithubRepoJobs(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  const seen = new Set<string>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_JOB_AGE_DAYS);

  for (const { owner, repo, isInternship } of GITHUB_REPOS) {
    if (results.length >= MAX_JOBS_PER_TICK) break;

    let content: string | null = null;

    for (const branch of BRANCH_FALLBACKS) {
      try {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'applyme-job-aggregator/1.0' },
        });
        if (res.ok) {
          content = await res.text();
          break;
        }
      } catch {
        continue;
      }
    }

    if (!content) continue;

    const jobs = parseHtmlTable(content, repo, isInternship, seen, cutoff);
    console.log(`[github] ${owner}/${repo}: ${jobs.length} jobs`);
    results.push(...jobs);
  }

  return results.slice(0, MAX_JOBS_PER_TICK);
}

function parseHtmlTable(
  content: string,
  repoName: string,
  isInternship: boolean,
  seen: Set<string>,
  cutoff?: Date,
): NormalizedJob[] {
  const results: NormalizedJob[] = [];

  // Extract all <tr>...</tr> blocks
  const rowMatches = content.matchAll(/<tr>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const row = rowMatch[1] ?? '';

    // Skip header rows (<th> cells)
    if (/<th[\s>]/i.test(row)) continue;

    // Extract <td> cells
    const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length < 3) continue;

    const companyCell  = cellMatches[0]?.[1] ?? '';
    const titleCell    = cellMatches[1]?.[1] ?? '';
    const locationCell = cellMatches[2]?.[1] ?? '';
    const applyCell    = cellMatches[3]?.[1] ?? '';
    const ageCell      = cellMatches[4]?.[1] ?? '';

    const cleanCompany = stripTags(companyCell).replace(/[🔥⭐]/g, '').trim();
    const cleanTitle   = stripTags(titleCell).trim();
    const locationRaw  = stripTags(locationCell).trim();

    if (!cleanCompany || !cleanTitle) continue;

    // Skip sub-role rows (company cell starts with ↳)
    if (cleanCompany.startsWith('↳')) continue;

    // Skip closed / not yet open rows
    if (applyCell.toLowerCase().includes('closed') || applyCell.trim() === '🔒') continue;

    // Extract the first https:// URL from the apply cell
    const urlMatch = applyCell.match(/href="(https?:\/\/[^"]+)"/i);
    const applyUrl = urlMatch?.[1] ?? '';
    if (!applyUrl) continue;

    // Skip Simplify banner/company profile links — keep only direct apply or simplify job links
    if (applyUrl.includes('simplify.jobs/install') || applyUrl.includes('simplify.jobs/c/')) continue;

    if (seen.has(applyUrl)) continue;
    seen.add(applyUrl);

    const isRemote = locationRaw.toLowerCase().includes('remote');
    const locationLower = locationRaw.toLowerCase();
    const country =
      locationLower.includes('canada') || /\b(on|bc|ab|qc|mb|sk|ns|nb|nl|pe)\b/i.test(locationRaw)
        ? 'CA'
        : locationLower.includes('united kingdom') || locationLower.includes(' uk')
          ? 'GB'
          : 'US';
    const category = classifyJobCategory(cleanTitle, '') ?? 'software';

    const externalId = `${repoName}-${cleanCompany}-${cleanTitle}`
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 100);

    // Determine employment type:
    // 1. Always classify from the actual title first (senior signals, co-op, explicit intern keywords)
    // 2. Only fall back to the repo's isInternship flag if the title alone gives no signal
    const titleEmploymentType = classifyEmploymentType(cleanTitle);
    // classifyEmploymentType returns 'full_time' for ambiguous titles too,
    // so check explicitly whether the title contains an internship signal
    const titleHasInternSignal = /\bintern(ship)?\b|\bco-?op\b|\bwork term\b|\bstudent\b|\bplacement\b|\bpracticum\b|\btrainee\b/i.test(cleanTitle);
    const employmentType = titleHasInternSignal
      ? titleEmploymentType          // explicit in title — use that
      : isInternship
        ? 'internship'               // repo says it's an internship listing
        : titleEmploymentType;       // new-grad / full-time repo — trust the title

    const postedAt = parseAgeCell(ageCell);
    // Skip jobs older than cutoff (null postedAt = unknown age, treat as recent)
    if (cutoff && postedAt && postedAt < cutoff) continue;

    results.push({
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
      canonicalUrlHash: simpleHash(applyUrl),
      fingerprint: simpleHash(`${cleanCompany}|${cleanTitle}|${locationRaw}`),
      salaryMin: null,
      salaryMax: null,
    });
  }

  return results;
}

/**
 * Parses the Age cell ("1d", "2d", "7d", "14d", "Aug 10", etc.) into a Date.
 * Returns null if unparseable.
 */
function parseAgeCell(cell: string): Date | null {
  if (!cell) return null;
  const text = stripTags(cell).replace(/\*\*/g, '').trim();
  if (!text) return null;

  // "Nd" format — N days ago
  const daysAgo = text.match(/^(\d+)\s*d$/i);
  if (daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(daysAgo[1]!, 10));
    return d;
  }

  // "Nh" format — N hours ago (same day)
  const hoursAgo = text.match(/^(\d+)\s*h$/i);
  if (hoursAgo) {
    const d = new Date();
    d.setHours(d.getHours() - parseInt(hoursAgo[1]!, 10));
    return d;
  }

  // Full date string fallback ("Aug 10", "2025-08-10", etc.)
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

// Simple synchronous hash for GitHub repo parsing (not cryptographic, just for dedup)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + str.length.toString(16);
}
