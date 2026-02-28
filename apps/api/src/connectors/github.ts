import { classifyJobCategory, classifyEmploymentType } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { isCanadianLocation, normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';

const GITHUB_REPOS = [
  { owner: 'SimplifyJobs', repo: 'Summer2025-Internships' },
  { owner: 'SimplifyJobs', repo: 'New-Grad-Positions' },
];

export async function fetchGithubRepoJobs(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];

  for (const { owner, repo } of GITHUB_REPOS) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/dev/README.md`;
    const res = await fetch(url);
    if (!res.ok) continue;

    const markdown = await res.text();
    const jobs = parseMarkdownTable(markdown, repo);
    results.push(...jobs);
  }

  return results;
}

function parseMarkdownTable(markdown: string, repoName: string): NormalizedJob[] {
  const results: NormalizedJob[] = [];
  const lines = markdown.split('\n');
  const isInternship = repoName.toLowerCase().includes('intern');

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);

    if (cells.length < 3) continue;

    const company = cells[0] ?? '';
    const title = cells[1] ?? '';
    const location = cells[2] ?? '';
    const applyLinkCell = cells[3] ?? '';
    const dateCell = cells[4] ?? '';

    // Skip header rows
    if (
      company.toLowerCase() === 'company' ||
      title.toLowerCase() === 'role' ||
      title.toLowerCase() === 'title'
    ) continue;

    // Skip closed positions
    if (applyLinkCell.toLowerCase().includes('closed') || company.startsWith('↳')) continue;

    if (!isCanadianLocation(location) && !location.toLowerCase().includes('canada')) continue;

    const category = classifyJobCategory(title, '');
    if (!category) continue;

    // Extract URL from markdown link [text](url)
    const urlMatch = applyLinkCell.match(/\[.*?\]\((https?:\/\/[^)]+)\)/);
    const applyUrl = urlMatch?.[1] ?? '';
    if (!applyUrl) continue;

    // Parse date
    const postedAt = parseDateCell(dateCell);

    // We'll use a placeholder for hash/fingerprint since we don't have await here
    // These will be computed synchronously using a simple hash approach for the sync context
    const externalId = `${repoName}-${company}-${title}`.replace(/\s+/g, '-').toLowerCase().slice(0, 100);

    results.push({
      externalId,
      company: company.replace(/\*\*/g, '').trim(),
      title: title.replace(/\*\*/g, '').trim(),
      location: normalizeLocation(location),
      country: 'CA',
      workplaceType: location.toLowerCase().includes('remote') ? 'remote' : null,
      postedAt,
      descriptionPlain: '',
      jobUrl: applyUrl,
      applyUrl,
      applyType: 'url',
      applyEmail: null,
      jobCategory: category,
      employmentType: isInternship
        ? classifyEmploymentType(`${title} intern`)
        : classifyEmploymentType(title),
      canonicalUrlHash: simpleHash(applyUrl),
      fingerprint: simpleHash(`${company}|${title}|${location}|${postedAt?.toISOString().slice(0, 10) ?? ''}`),
    });
  }

  return results;
}

function parseDateCell(cell: string): Date | null {
  if (!cell) return null;
  const cleaned = cell.replace(/\*\*/g, '').trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
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
