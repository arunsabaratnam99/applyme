import { eq, and, lt, isNull } from 'drizzle-orm';
import { schema, createDb } from '@applyme/db';
import { scoreJob, passesHardFilters } from '@applyme/shared/scoring';
import { getPeersForCompany, isTier1Company } from '@applyme/shared';
import { draftExpiresAt, queueExpiresAt, applicationExpiresAt } from '@applyme/shared/utils';
import { fetchAshbyJobs } from '../connectors/ashby.js';
import { fetchLeverJobs } from '../connectors/lever.js';
import { fetchGreenhouseJobs } from '../connectors/greenhouse.js';
import { fetchJobBankJobs } from '../connectors/jobbank.js';
import { fetchGithubRepoJobs } from '../connectors/github.js';
import type { NormalizedJob } from '../connectors/ashby.js';
import type { Env } from '../types.js';

export async function runCronTick(env: Env): Promise<void> {
  const db = createDb(env.DATABASE_URL);

  try {
    await ingestJobs(db, env);
    await runMatching(db);
    await runPeerDiscovery(db);
    await expireStaleItems(db);
  } catch (err) {
    console.error('[cron] tick error:', err);
    throw err;
  }
}

// ─── Job ingestion ─────────────────────────────────────────────────────────────

async function ingestJobs(db: ReturnType<typeof createDb>, env: Env): Promise<void> {
  const sources = await db.query.jobSources.findMany({
    where: eq(schema.jobSources.enabled, true),
  });

  const allJobs: Array<NormalizedJob & { sourceId: string; sourceType: string }> = [];

  for (const source of sources) {
    const config = source.config as Record<string, string>;
    let jobs: NormalizedJob[] = [];

    try {
      switch (source.sourceType) {
        case 'ashby':
          jobs = await fetchAshbyJobs(config['boardSlug'] ?? '');
          break;
        case 'lever':
          jobs = await fetchLeverJobs(config['siteSlug'] ?? '');
          break;
        case 'greenhouse':
          jobs = await fetchGreenhouseJobs(config['boardToken'] ?? '');
          break;
        case 'jobbank_ca':
          jobs = await fetchJobBankJobs();
          break;
        case 'github_repo':
          jobs = await fetchGithubRepoJobs();
          break;
        case 'linkedin':
          if (env.LINKEDIN_ENABLED !== 'true') break;
          // LinkedIn connector: feature-flagged, implement when API access granted
          break;
        case 'indeed':
          if (env.INDEED_ENABLED !== 'true') break;
          // Indeed connector: feature-flagged, implement when Publisher account set up
          break;
      }
    } catch (err) {
      console.error(`[cron] connector error for ${source.sourceType}:`, err);
    }

    allJobs.push(...jobs.map((j) => ({ ...j, sourceId: source.id, sourceType: source.sourceType })));
  }

  // Upsert jobs — ignore conflicts on canonical_url_hash or fingerprint
  for (const job of allJobs) {
    try {
      await db.insert(schema.jobs).values({
        sourceId: job.sourceId,
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
        sourceType: job.sourceType,
        jobCategory: job.jobCategory,
        employmentType: job.employmentType,
      }).onConflictDoNothing();
    } catch {
      // Silently skip duplicate
    }
  }

  console.log(`[cron] ingested ${allJobs.length} jobs from ${sources.length} sources`);
}

// ─── Matching ──────────────────────────────────────────────────────────────────

async function runMatching(db: ReturnType<typeof createDb>): Promise<void> {
  const users = await db.query.users.findMany({
    where: isNull(schema.users.deletedAt),
    with: { profile: true },
  });

  for (const user of users) {
    if (!user.profile) continue;

    const watchlist = await db.query.watchlists.findFirst({
      where: eq(schema.watchlists.userId, user.id),
      with: { items: true },
    });

    const recentJobs = await db.query.jobs.findMany({
      where: eq(schema.jobs.country, 'CA'),
      orderBy: (j, { desc }) => [desc(j.createdAt)],
      limit: 500,
    });

    const profile = {
      userId: user.profile.userId,
      locations: (user.profile.locations as string[]) ?? [],
      preferredRemote: user.profile.preferredRemote,
      salaryMin: null,
      salaryMax: null,
      visaAuth: user.profile.visaAuth,
      keywords: (user.profile.keywords as string[]) ?? [],
      roles: (user.profile.roles as string[]) ?? [],
      excludeKeywords: (user.profile.excludeKeywords as string[]) ?? [],
      country: user.profile.country,
      jobCategories: (user.profile.jobCategories as ('software' | 'business')[]) ?? ['software', 'business'],
      employmentTypes: (user.profile.employmentTypes as ('full_time' | 'internship' | 'co_op')[]) ?? ['full_time', 'internship', 'co_op'],
    };

    for (const job of recentJobs) {
      // Skip if already matched
      const existing = await db.query.jobMatches.findFirst({
        where: and(
          eq(schema.jobMatches.userId, user.id),
          eq(schema.jobMatches.jobId, job.id),
        ),
      });
      if (existing) continue;

      const jobForScoring = {
        id: job.id,
        sourceId: job.sourceId,
        externalId: job.externalId,
        canonicalUrlHash: job.canonicalUrlHash,
        fingerprint: job.fingerprint,
        company: job.company,
        title: job.title,
        location: job.location,
        country: job.country,
        workplaceType: job.workplaceType as 'remote' | 'hybrid' | 'onsite' | null,
        postedAt: job.postedAt,
        descriptionPlain: job.descriptionPlain,
        jobUrl: job.jobUrl,
        applyUrl: job.applyUrl,
        applyType: job.applyType as 'url' | 'email',
        applyEmail: job.applyEmail,
        sourceType: job.sourceType as 'ashby' | 'lever' | 'greenhouse' | 'jobbank_ca' | 'linkedin' | 'indeed' | 'github_repo',
        jobCategory: job.jobCategory as 'software' | 'business',
        employmentType: job.employmentType as 'full_time' | 'internship' | 'co_op',
        createdAt: job.createdAt,
      };

      const result = scoreJob({
        job: jobForScoring,
        profile,
        watchlistItems: (watchlist?.items ?? []).map((item) => ({
          id: item.id,
          watchlistId: item.watchlistId,
          itemType: item.itemType as 'company' | 'role' | 'keyword',
          value: item.value,
          atsUrl: item.atsUrl,
          companyTier: item.companyTier as 'tier1' | 'standard',
          autoDiscoverPeers: item.autoDiscoverPeers,
        })),
      });

      if (!result.passed || result.score < 30) continue;

      await db.insert(schema.jobMatches).values({
        userId: user.id,
        jobId: job.id,
        score: result.score,
        reasons: result.reasons,
      });
    }
  }

  console.log('[cron] matching complete');
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
    const userId = item.watchlist.userId;
    const peers = getPeersForCompany(item.value);

    for (const peer of peers.slice(0, 5)) {
      // Check if peer already in watchlist
      const exists = await db.query.watchlistItems.findFirst({
        where: and(
          eq(schema.watchlistItems.watchlistId, item.watchlistId),
          eq(schema.watchlistItems.value, peer.peerCompany),
        ),
      });
      if (exists) continue;

      // Add peer to watchlist
      await db.insert(schema.watchlistItems).values({
        watchlistId: item.watchlistId,
        itemType: 'company',
        value: peer.peerCompany,
        companyTier: isTier1Company(peer.peerCompany) ? 'tier1' : 'standard',
        autoDiscoverPeers: false,
      });

      // Notify user
      await db.insert(schema.notifications).values({
        userId,
        type: 'peer_auto_added',
        payload: {
          message: `Added ${peer.peerCompany} to your watchlist because you watch ${item.value}`,
          anchorCompany: item.value,
          peerCompany: peer.peerCompany,
          similarityScore: peer.similarityScore,
          tags: peer.peerTags,
        },
      });
    }
  }

  console.log('[cron] peer discovery complete');
}

// ─── Expiry sweep ──────────────────────────────────────────────────────────────

async function expireStaleItems(db: ReturnType<typeof createDb>): Promise<void> {
  const now = new Date();

  // Expire autofill queue items older than 72h
  const expiredQueue = await db.query.autofillQueue.findMany({
    where: and(
      eq(schema.autofillQueue.status, 'pending'),
      lt(schema.autofillQueue.expiresAt, now),
    ),
    with: { job: true },
  });

  for (const item of expiredQueue) {
    await db
      .update(schema.autofillQueue)
      .set({ status: 'expired' })
      .where(eq(schema.autofillQueue.id, item.id));

    // Notify user
    await db.insert(schema.notifications).values({
      userId: item.userId,
      type: 'autofill_expired',
      payload: {
        message: `Your application to ${item.job?.company ?? 'a company'} expired — the job may still be open`,
        jobId: item.jobId,
        applyUrl: item.applyUrl,
        company: item.job?.company ?? '',
        title: item.job?.title ?? '',
      },
    });
  }

  // Mark expired drafts
  await db
    .update(schema.applicationDrafts)
    .set({ status: 'sent' }) // 'sent' is closest to expired in current enum; we filter by expiresAt in UI
    .where(
      and(
        eq(schema.applicationDrafts.status, 'pending'),
        lt(schema.applicationDrafts.expiresAt, now),
      ),
    );

  console.log(`[cron] expired ${expiredQueue.length} autofill queue items`);
}
