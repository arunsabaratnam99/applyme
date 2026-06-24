import { eq, and, inArray, sql } from 'drizzle-orm';
import { schema, createDb } from '@applyme/db';
import { getPeersForCompany, isTier1Company } from '@applyme/shared';
import { fetchAshbyJobs } from '../connectors/ashby.js';
import { fetchLeverJobs } from '../connectors/lever.js';
import { fetchGreenhouseJobs } from '../connectors/greenhouse.js';
import { fetchJobBankJobs } from '../connectors/jobbank.js';
import { fetchGithubRepoJobs, DEFAULT_GITHUB_REPOS, type GithubRepoConfig } from '../connectors/github.js';
import { fetchRemotiveJobs } from '../connectors/remotive.js';
import { fetchWorkAtStartupJobs } from '../connectors/workatastartup.js';
import { fetchLinkedInJobs } from '../connectors/linkedin_scraper.js';
import type { RequestBudget } from '../connectors/linkedin_scraper.js';
import { fetchIndeedJobs } from '../connectors/indeed_scraper.js';
import { fetchTheMuseJobs } from '../connectors/themuse.js';
import { fetchArbeitnowJobs } from '../connectors/arbeitnow.js';
import type { NormalizedJob } from '../connectors/ashby.js';
import type { Env } from '../types.js';

// Fast tick: ingest only (runs every 15 min)
// Full tick: ingest + peer discovery (runs every 4 h)
const FAST_CRON = '*/15 * * * *';

export async function runCronTick(env: Env, cron?: string): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  const isFast = cron === FAST_CRON;

  console.log(`[cron] tick type: ${isFast ? 'fast (ingest)' : 'full'}, cron="${cron ?? 'manual'}"`);

  try {
    await ingestJobs(db, env, isFast);
    if (!isFast) {
      await runPeerDiscovery(db);
    }
  } catch (err) {
    console.error('[cron] tick error:', err);
    throw err;
  }
}

// Collect distinct, enabled (owner, repo) pairs across all users so the cron
// ingests every user-added internship repo in a single pass.
async function fetchEnabledUserRepos(
  db: ReturnType<typeof createDb>,
): Promise<GithubRepoConfig[]> {
  try {
    const rows = await db.query.internshipSources.findMany({
      where: eq(schema.internshipSources.enabled, true),
      columns: { owner: true, repo: true, isInternship: true },
    });
    const seen = new Set<string>();
    const out: GithubRepoConfig[] = [];
    for (const r of rows) {
      const key = `${r.owner.toLowerCase()}/${r.repo.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ owner: r.owner, repo: r.repo, isInternship: r.isInternship });
    }
    return out;
  } catch (err) {
    console.error('[cron] failed to load user internship_sources:', err);
    return [];
  }
}

// ─── Job ingestion ─────────────────────────────────────────────────────────────

async function ingestJobs(db: ReturnType<typeof createDb>, env: Env, isFast = false): Promise<void> {
  const sources = await db.query.jobSources.findMany({
    where: eq(schema.jobSources.enabled, true),
  });

  let totalNew = 0;
  let totalSkipped = 0;
  // Shared subrequest budget across all connectors — Cloudflare Workers limit is 50.
  // Reserve ~20 for DB WebSocket connections (Neon opens a WS per query invocation).
  const budget: RequestBudget = { used: 0, limit: 45 };

  for (const source of sources) {
    const config = source.config as Record<string, string>;
    let rawJobs: NormalizedJob[] = [];

    // MVP: only scrape from LinkedIn and GitHub
    const MVP_SOURCES = new Set(['linkedin_scraper', 'github_repo']);
    if (!MVP_SOURCES.has(source.sourceType)) {
      console.log(`[cron] skipping non-MVP source: ${source.sourceType}`);
      continue;
    }

    try {
      switch (source.sourceType) {
        case 'ashby':
          rawJobs = await fetchAshbyJobs(config['boardSlug'] ?? '', budget);
          break;
        case 'lever':
          rawJobs = await fetchLeverJobs(config['siteSlug'] ?? '', budget);
          break;
        case 'greenhouse':
          rawJobs = await fetchGreenhouseJobs(config['boardToken'] ?? '', budget);
          break;
        case 'jobbank_ca':
          rawJobs = await fetchJobBankJobs(budget);
          break;
        case 'github_repo': {
          const userRepos = await fetchEnabledUserRepos(db);
          rawJobs = await fetchGithubRepoJobs([...DEFAULT_GITHUB_REPOS, ...userRepos]);
          break;
        }
        case 'remotive':
          rawJobs = await fetchRemotiveJobs(budget);
          break;
        case 'workatastartup':
          rawJobs = await fetchWorkAtStartupJobs();
          break;
        case 'linkedin_scraper':
          if (env.LINKEDIN_SCRAPER_ENABLED === 'false') break;
          rawJobs = await fetchLinkedInJobs(budget);
          break;
        case 'indeed_scraper':
          if (env.INDEED_SCRAPER_ENABLED === 'false') break;
          rawJobs = await fetchIndeedJobs(env);
          break;
        case 'themuse':
          rawJobs = await fetchTheMuseJobs(budget);
          break;
        case 'arbeitnow':
          rawJobs = await fetchArbeitnowJobs(budget);
          break;
      }
    } catch (err) {
      console.error(`[cron] connector error for ${source.sourceType}:`, err);
      continue;
    }

    // Skip-known: filter out externalIds already seen in the last run.
    // linkedin_scraper and indeed_scraper always return the same page-1 results, so
    // the cache would block every new insert after run 1. Use DB onConflictDoNothing
    // as the sole dedup mechanism for those sources.
    const skipCache = source.sourceType === 'linkedin_scraper' || source.sourceType === 'indeed_scraper';
    const knownIds = new Set<string>(
      skipCache || !Array.isArray(source.lastExternalIds) ? [] : (source.lastExternalIds as string[]),
    );
    const currentIds = rawJobs.map((j) => j.externalId);
    const newJobs = skipCache ? rawJobs : rawJobs.filter((j) => !knownIds.has(j.externalId));
    const skipped = rawJobs.length - newJobs.length;

    console.log(`[cron] ${source.sourceType}: ${rawJobs.length} fetched, ${newJobs.length} new, ${skipped} skipped`);
    totalSkipped += skipped;

    // Bulk-insert in chunks of 100 to minimise DB round-trips
    const CHUNK = 100;
    const rows = newJobs.map((job) => ({
      sourceId: source.id,
      externalId: job.externalId,
      canonicalUrlHash: job.canonicalUrlHash,
      fingerprint: job.fingerprint,
      company: job.company,
      title: job.title,
      location: job.location,
      country: job.country,
      workplaceType: job.workplaceType,
      postedAt: job.postedAt,
      descriptionPlain: job.descriptionPlain,
      jobUrl: job.jobUrl,
      applyUrl: job.applyUrl,
      applyType: job.applyType,
      applyEmail: job.applyEmail,
      sourceType: source.sourceType,
      sourceRepo: job.sourceRepo ?? null,
      jobCategory: job.jobCategory,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin != null ? String(job.salaryMin) : null,
      salaryMax: job.salaryMax != null ? String(job.salaryMax) : null,
    }));

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        try {
          const chunk = rows.slice(i, i + CHUNK);
          if (source.sourceType === 'github_repo') {
            await db.insert(schema.jobs).values(chunk).onConflictDoUpdate({
              target: schema.jobs.canonicalUrlHash,
              set: { sourceRepo: sql`EXCLUDED.source_repo` },
            });
          } else {
            await db.insert(schema.jobs).values(chunk).onConflictDoNothing();
          }
        } catch {
          // Silently skip chunk on error
        }
      }
      totalNew += rows.length;
    }

    // Update source tracking — cap stored IDs to 500 most recent to avoid JSONB bloat
    const storedIds = currentIds.slice(-500);
    await db
      .update(schema.jobSources)
      .set({ lastFetchedAt: new Date(), lastExternalIds: storedIds })
      .where(eq(schema.jobSources.id, source.id));
  }

  console.log(`[cron] ingested ${totalNew} new jobs, skipped ${totalSkipped} known jobs from ${sources.length} sources`);
}

// ─── Peer discovery ────────────────────────────────────────────────────────────

async function runPeerDiscovery(db: ReturnType<typeof createDb>): Promise<void> {
  const watchlistsWithPeerDiscovery = await db.query.watchlistItems.findMany({
    where: and(
      eq(schema.watchlistItems.itemType, 'company'),
      eq(schema.watchlistItems.autoDiscoverPeers, true),
    ),
    with: { watchlist: true },
  });

  for (const item of watchlistsWithPeerDiscovery) {
    const peers = getPeersForCompany(item.value).slice(0, 5);
    if (peers.length === 0) continue;

    // Bulk-check which peers are already in the watchlist
    const peerNames = peers.map((p) => p.peerCompany);
    const existingItems = await db.query.watchlistItems.findMany({
      where: and(
        eq(schema.watchlistItems.watchlistId, item.watchlistId),
        inArray(schema.watchlistItems.value, peerNames),
      ),
    });
    const existingValues = new Set(existingItems.map((e) => e.value));

    const newPeers = peers.filter((p) => !existingValues.has(p.peerCompany));
    if (newPeers.length === 0) continue;

    await db.insert(schema.watchlistItems).values(
      newPeers.map((peer) => ({
        watchlistId: item.watchlistId,
        itemType: 'company' as const,
        value: peer.peerCompany,
        companyTier: (isTier1Company(peer.peerCompany) ? 'tier1' : 'standard') as 'tier1' | 'standard',
        autoDiscoverPeers: false,
      })),
    );
  }

  console.log('[cron] peer discovery complete');
}
