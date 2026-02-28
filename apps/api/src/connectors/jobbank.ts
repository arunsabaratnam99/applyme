import { classifyJobCategory, classifyEmploymentType } from '@applyme/shared/classify';
import { computeCanonicalUrlHash, computeFingerprint } from '@applyme/shared/canonicalize';
import { isCanadianLocation, normalizeLocation } from '@applyme/shared/utils';
import type { NormalizedJob } from './ashby.js';

const JOB_BANK_RSS = 'https://www.jobbank.gc.ca/jobsearch/rss';
const SEARCH_TERMS = ['software', 'developer', 'engineer', 'analyst', 'data', 'business'];

export async function fetchJobBankJobs(): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];
  const seen = new Set<string>();

  await Promise.all(
    SEARCH_TERMS.map(async (term) => {
      const url = `${JOB_BANK_RSS}?searchstring=${encodeURIComponent(term)}&locationstring=Canada&sort=M&noe=50&lang=eng`;
      const res = await fetch(url);
      if (!res.ok) return;

      const xml = await res.text();
      const items = parseRssItems(xml);

      for (const item of items) {
        if (seen.has(item.guid)) continue;
        seen.add(item.guid);

        const location = item.location ?? 'Canada';
        if (!isCanadianLocation(location)) continue;

        const category = classifyJobCategory(item.title, item.description ?? '');
        if (!category) continue;

        const canonicalUrlHash = await computeCanonicalUrlHash(item.link);
        const fingerprint = await computeFingerprint({
          company: item.source ?? 'Job Bank',
          title: item.title,
          location: normalizeLocation(location),
          postedAt: item.pubDate ? new Date(item.pubDate) : null,
        });

        results.push({
          externalId: item.guid,
          company: item.source ?? 'Job Bank Canada',
          title: item.title,
          location: normalizeLocation(location),
          country: 'CA',
          workplaceType: null,
          postedAt: item.pubDate ? new Date(item.pubDate) : null,
          descriptionPlain: item.description ?? '',
          jobUrl: item.link,
          applyUrl: item.link,
          applyType: 'url',
          applyEmail: null,
          jobCategory: category,
          employmentType: classifyEmploymentType(item.title),
          canonicalUrlHash,
          fingerprint,
        });
      }
    }),
  );

  return results;
}

interface RssItem {
  title: string;
  link: string;
  guid: string;
  description: string | undefined;
  pubDate: string | undefined;
  location: string | undefined;
  source: string | undefined;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const block = match[1] ?? '';
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') ?? extractTag(block, 'guid');
    const guid = extractTag(block, 'guid') ?? link ?? '';
    if (!title || !link) continue;

    items.push({
      title: decodeXml(title),
      link: decodeXml(link),
      guid: decodeXml(guid),
      description: decodeXml(extractTag(block, 'description') ?? ''),
      pubDate: extractTag(block, 'pubDate') ?? undefined,
      location: extractTag(block, 'city') ?? extractTag(block, 'location') ?? undefined,
      source: extractTag(block, 'source') ?? undefined,
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
    ?? xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
