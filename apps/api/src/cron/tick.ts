import { eq, and, lt, isNull, inArray } from 'drizzle-orm';
import { schema, createDb } from '@applyme/db';
import { scoreJob, passesHardFilters } from '@applyme/shared/scoring';
import { getPeersForCompany, isTier1Company } from '@applyme/shared';
import { draftExpiresAt, queueExpiresAt, applicationExpiresAt } from '@applyme/shared/utils';
import { attemptApply } from '../applicators/index.js';
import type { ApplyPayload } from '../applicators/index.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fetchAshbyJobs } from '../connectors/ashby.js';
import { fetchLeverJobs } from '../connectors/lever.js';
import { fetchGreenhouseJobs } from '../connectors/greenhouse.js';
import { fetchJobBankJobs } from '../connectors/jobbank.js';
import { fetchGithubRepoJobs } from '../connectors/github.js';
import { fetchRemotiveJobs } from '../connectors/remotive.js';
import { fetchWorkAtStartupJobs } from '../connectors/workatastartup.js';
import { fetchLinkedInJobs } from '../connectors/linkedin_scraper.js';
import type { RequestBudget } from '../connectors/linkedin_scraper.js';
import { fetchIndeedJobs } from '../connectors/indeed_scraper.js';
import { fetchTheMuseJobs } from '../connectors/themuse.js';
import { fetchArbeitnowJobs } from '../connectors/arbeitnow.js';
import type { NormalizedJob } from '../connectors/ashby.js';
import type { Env } from '../types.js';

// Fast tick: ingest + match only (runs every 15 min)
// Full tick: all phases (runs every 4 h)
const FAST_CRON = '*/15 * * * *';

export async function runCronTick(env: Env, cron?: string): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  const isFast = cron === FAST_CRON;

  console.log(`[cron] tick type: ${isFast ? 'fast (ingest+match)' : 'full'}, cron="${cron ?? 'manual'}"`);

  try {
    await ingestJobs(db, env, isFast);
    await runMatching(db);
    if (!isFast) {
      await runPeerDiscovery(db);
      await expireStaleItems(db);
      await runAutoApply(db, env);
    }
  } catch (err) {
    console.error('[cron] tick error:', err);
    throw err;
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
        case 'github_repo':
          rawJobs = await fetchGithubRepoJobs();
          break;
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
      jobCategory: job.jobCategory,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin != null ? String(job.salaryMin) : null,
      salaryMax: job.salaryMax != null ? String(job.salaryMax) : null,
    }));

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        try {
          await db.insert(schema.jobs).values(rows.slice(i, i + CHUNK)).onConflictDoNothing();
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

// ─── Matching ──────────────────────────────────────────────────────────────────

async function runMatching(db: ReturnType<typeof createDb>): Promise<void> {
  const users = await db.query.users.findMany({
    where: isNull(schema.users.deletedAt),
    with: { profile: true },
  });

  // Fetch recent jobs once — shared across all users
  const recentJobs = await db.query.jobs.findMany({
    where: eq(schema.jobs.country, 'CA'),
    orderBy: (j, { desc }) => [desc(j.createdAt)],
    limit: 500,
  });
  const jobIds = recentJobs.map((j) => j.id);

  for (const user of users) {
    if (!user.profile) continue;

    const watchlist = await db.query.watchlists.findFirst({
      where: eq(schema.watchlists.userId, user.id),
      with: { items: true },
    });

    // Bulk-load all existing matches for this user in one query
    const existingMatches = jobIds.length > 0
      ? await db.query.jobMatches.findMany({
          where: and(
            eq(schema.jobMatches.userId, user.id),
            inArray(schema.jobMatches.jobId, jobIds),
          ),
        })
      : [];
    const matchedJobIds = new Set(existingMatches.map((m) => m.jobId));

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

    const watchlistItems = (watchlist?.items ?? []).map((item) => ({
      id: item.id,
      watchlistId: item.watchlistId,
      itemType: item.itemType as 'company' | 'role' | 'keyword',
      value: item.value,
      atsUrl: item.atsUrl,
      companyTier: item.companyTier as 'tier1' | 'standard',
      autoDiscoverPeers: item.autoDiscoverPeers,
    }));

    const toInsert: Array<{ userId: string; jobId: string; score: number; reasons: unknown }> = [];

    for (const job of recentJobs) {
      if (matchedJobIds.has(job.id)) continue;

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
        sourceType: job.sourceType as 'ashby' | 'lever' | 'greenhouse' | 'jobbank_ca' | 'linkedin' | 'indeed' | 'github_repo' | 'remotive' | 'workatastartup' | 'linkedin_scraper' | 'indeed_scraper',
        jobCategory: job.jobCategory as 'software' | 'business',
        employmentType: job.employmentType as 'full_time' | 'internship' | 'co_op',
        createdAt: job.createdAt,
      };

      const result = scoreJob({ job: jobForScoring, profile, watchlistItems });
      if (!result.passed || result.score < 30) continue;

      toInsert.push({ userId: user.id, jobId: job.id, score: result.score, reasons: result.reasons });
    }

    // Bulk-insert all new matches for this user in one statement
    if (toInsert.length > 0) {
      await db.insert(schema.jobMatches).values(toInsert).onConflictDoNothing();
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

    await db.insert(schema.notifications).values(
      newPeers.map((peer) => ({
        userId,
        type: 'peer_auto_added',
        payload: {
          message: `Added ${peer.peerCompany} to your watchlist because you watch ${item.value}`,
          anchorCompany: item.value,
          peerCompany: peer.peerCompany,
          similarityScore: peer.similarityScore,
          tags: peer.peerTags,
        },
      })),
    );
  }

  console.log('[cron] peer discovery complete');
}

// ─── Auto-apply retry ─────────────────────────────────────────────────────────

async function runAutoApply(db: ReturnType<typeof createDb>, env: Env): Promise<void> {
  const now = new Date();

  // Find pending queue items that haven't been attempted yet (attemptCount = 0)
  // or have been attempted fewer than 3 times and aren't expired
  const pendingItems = await db.query.autofillQueue.findMany({
    where: eq(schema.autofillQueue.status, 'pending'),
    with: { job: true, draft: true },
    limit: 20,
  });

  // Filter: only items not yet attempted or attemptCount < 3 and still valid
  const toRetry = pendingItems.filter(
    (item) => item.attemptCount < 3 && item.expiresAt > now,
  );

  if (toRetry.length === 0) {
    console.log('[cron] auto-apply: no pending items to retry');
    return;
  }

  console.log(`[cron] auto-apply: retrying ${toRetry.length} pending queue items`);

  const s3 = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });

  for (const item of toRetry) {
    try {
      // Get resume signed URL
      let resumePdfUrl: string | null = null;
      if (item.draft?.resumeVersionId) {
        const resumeVersion = await db.query.resumeVersions.findFirst({
          where: eq(schema.resumeVersions.id, item.draft.resumeVersionId),
        });
        if (resumeVersion?.r2Key) {
          try {
            resumePdfUrl = await getSignedUrl(
              s3,
              new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: resumeVersion.r2Key }),
              { expiresIn: 900 },
            );
          } catch { /* continue without resume */ }
        }
      }

      const fieldMap = item.fieldMap as ApplyPayload['fieldMap'];
      const payload: ApplyPayload = {
        queueItemId: item.id,
        applyUrl: item.applyUrl,
        atsType: item.atsType,
        fieldMap,
        resumePdfUrl,
        coverLetter: item.draft?.coverLetter ?? '',
      };

      // Mark as being attempted
      await db
        .update(schema.autofillQueue)
        .set({ attemptCount: item.attemptCount + 1, attemptedAt: new Date() })
        .where(eq(schema.autofillQueue.id, item.id));

      const result = await attemptApply(payload, env);

      if (result.success) {
        await db
          .update(schema.autofillQueue)
          .set({ status: 'completed', submissionResponse: result.response ?? null })
          .where(eq(schema.autofillQueue.id, item.id));

        await db.insert(schema.applications).values({
          userId: item.userId,
          jobId: item.jobId,
          draftId: item.draftId,
          status: 'applied',
          submittedData: {
            name: fieldMap.fields.find((f) => f.fieldKey === 'first_name')?.profileValue ?? '',
            email: fieldMap.fields.find((f) => f.fieldKey === 'email')?.profileValue ?? '',
            coverLetter: item.draft?.coverLetter ?? '',
            atsType: item.atsType,
            applyUrl: item.applyUrl,
            timestamp: new Date().toISOString(),
            applyMethod: item.atsType === 'ashby' || item.atsType === 'greenhouse' || item.atsType === 'lever' ? 'ats_api' : 'autofill_queue',
          },
          applyMethod: item.atsType === 'ashby' || item.atsType === 'greenhouse' || item.atsType === 'lever' ? 'ats_api' : 'autofill_queue',
          expiresAt: applicationExpiresAt(),
        });

        await db.update(schema.applicationDrafts)
          .set({ status: 'sent' })
          .where(eq(schema.applicationDrafts.id, item.draftId));

        await db.insert(schema.notifications).values({
          userId: item.userId,
          type: 'application_sent',
          payload: {
            message: `Application submitted to ${item.job?.company ?? 'company'} — ${item.job?.title ?? 'role'}`,
            jobId: item.jobId,
            company: item.job?.company ?? '',
            title: item.job?.title ?? '',
            atsType: item.atsType,
          },
        });
      } else {
        if (item.attemptCount + 1 >= 3) {
          await db
            .update(schema.autofillQueue)
            .set({ status: 'failed', errorDetail: result.error ?? 'Unknown error' })
            .where(eq(schema.autofillQueue.id, item.id));

          await db.insert(schema.notifications).values({
            userId: item.userId,
            type: 'quick_apply_error',
            payload: {
              message: `Quick Apply failed for ${item.job?.title ?? 'role'} at ${item.job?.company ?? 'company'}`,
              jobTitle: item.job?.title ?? null,
              company: item.job?.company ?? null,
              atsType: item.atsType,
              errorDetail: result.error ?? 'Unknown error',
            },
          });
        }
      }
    } catch (err) {
      console.error(`[cron] auto-apply error for queue item ${item.id}:`, err);
    }
  }

  console.log('[cron] auto-apply complete');
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
