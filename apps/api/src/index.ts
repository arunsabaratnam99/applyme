import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDb, createPool, schema } from '@applyme/db';
import { withDb } from './middleware/db.js';
import { requireAuth } from './middleware/auth.js';
import { auth } from './routes/auth.js';
import { profile } from './routes/profile.js';
import { resumes } from './routes/resumes.js';
import { jobs, matches } from './routes/jobs.js';
import { drafts, applications, autofillQueue } from './routes/applications.js';
import { autofillProfiles } from './routes/autofill-profiles.js';
import { watchlist } from './routes/watchlist.js';
import { notifications } from './routes/notifications.js';
import { runCronTick } from './cron/tick.js';
import { SEARCH_QUERIES, MAX_QUERIES } from './connectors/linkedin_scraper.js';
import { eq, like } from 'drizzle-orm';
import { attemptApply } from './applicators/index.js';
import { resolveLinkedInApplyUrl } from './applicators/browser.js';
import type { Env, Variables } from './types.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use('*', logger());

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const appBase = c.env?.APP_BASE_URL ?? 'http://localhost:3000';
      if (!origin) return appBase;
      // Allow localhost in dev
      const isDev = appBase.startsWith('http://localhost') || appBase.startsWith('http://127.0.0.1');
      if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return origin;
      // Allow exact match
      if (origin === appBase) return origin;
      // Allow Netlify deploy previews (*.netlify.app)
      if (origin.endsWith('.netlify.app')) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.use('*', withDb);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// ─── Auth routes (no auth required) ──────────────────────────────────────────

app.route('/auth', auth);

// ─── Admin: manual cron trigger (dev + on-demand) ─────────────────────────────

app.post('/api/admin/cron', async (c) => {
  try {
    await runCronTick(c.env);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[admin/cron] error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

// ─── Admin: test-apply (dev only — triggers attemptApply directly) ────────────

app.post('/api/admin/test-apply', async (c) => {
  try {
    const body = await c.req.json() as {
      applyUrl: string;
      atsType?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    const { applyUrl, atsType = 'unknown', firstName = 'Test', lastName = 'User', email = 'test@example.com', phone = '4165550000' } = body;
    if (!applyUrl) return c.json({ error: 'applyUrl is required' }, 400);

    const fieldMap = {
      fields: [
        { fieldKey: 'first_name',   selector: null, label: 'First Name',  profileValue: firstName, inputType: 'text' },
        { fieldKey: 'last_name',    selector: null, label: 'Last Name',   profileValue: lastName,  inputType: 'text' },
        { fieldKey: 'email',        selector: null, label: 'Email',       profileValue: email,     inputType: 'email' },
        { fieldKey: 'phone',        selector: null, label: 'Phone',       profileValue: phone,     inputType: 'tel' },
        { fieldKey: 'linkedin_url', selector: null, label: 'LinkedIn',    profileValue: '',        inputType: 'text' },
        { fieldKey: 'github_url',   selector: null, label: 'GitHub',      profileValue: '',        inputType: 'text' },
        { fieldKey: 'website_url',  selector: null, label: 'Website',     profileValue: '',        inputType: 'text' },
      ],
      atsType,
      domain: (() => { try { return new URL(applyUrl).hostname; } catch { return ''; } })(),
      learnedAt: null,
    };

    const result = await attemptApply({ queueItemId: 'test', applyUrl, atsType, fieldMap, resumePdfUrl: null, coverLetter: '' }, c.env);
    return c.json({ result });
  } catch (err) {
    console.error('[admin/test-apply] error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

// ─── Protected routes ─────────────────────────────────────────────────────────

app.use('/api/*', requireAuth);

app.route('/api/profile', profile);
app.route('/api/resumes', resumes);
app.route('/api/jobs', jobs);
app.route('/api/matches', matches);
app.route('/api/drafts', drafts);
app.route('/api/applications', applications);
app.route('/api/autofill-queue', autofillQueue);
app.route('/api/autofill-profiles', autofillProfiles);
app.route('/api/watchlist', watchlist);
app.route('/api/notifications', notifications);

// ─── Admin: refresh status + manual trigger (auth-protected) ─────────────────

app.get('/api/admin/refresh-status', async (c) => {
  const pool = createPool(c.env.DATABASE_URL);
  const db = createDb(pool);
  try {
    const sources = await db.query.jobSources.findMany({
      where: eq(schema.jobSources.enabled, true),
    });
    const latest = sources
      .map((s: { lastFetchedAt: Date | null }) => s.lastFetchedAt)
      .filter((d: Date | null): d is Date => d instanceof Date)
      .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] ?? null;
    return c.json({ lastFetchedAt: latest ? latest.toISOString() : null });
  } finally {
    await pool.end();
  }
});

app.post('/api/admin/refresh', async (c) => {
  try {
    await runCronTick(c.env, '*/15 * * * *');
    return c.json({ ok: true });
  } catch (err) {
    console.error('[admin/refresh] error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

// ─── Admin: backfill LinkedIn apply URLs for existing DB rows ────────────────

app.post('/api/admin/backfill-linkedin-urls', async (c) => {
  const db = c.get('db');
  try {
    const liJobs = await db.query.jobs.findMany({
      where: like(schema.jobs.applyUrl, 'https://www.linkedin.com%'),
      columns: { id: true, jobUrl: true, applyUrl: true },
    });

    console.log(`[backfill] found ${liJobs.length} jobs with LinkedIn applyUrl`);

    let updated = 0;
    const BATCH = 5;

    for (let i = 0; i < liJobs.length; i += BATCH) {
      const batch = liJobs.slice(i, i + BATCH);
      await Promise.all(batch.map(async (job) => {
        try {
          const resolved = await resolveLinkedInApplyUrl(job.jobUrl);
          if (resolved && resolved !== job.applyUrl) {
            await db.update(schema.jobs)
              .set({ applyUrl: resolved })
              .where(eq(schema.jobs.id, job.id));
            updated++;
            console.log(`[backfill] updated job ${job.id}: ${resolved.slice(0, 80)}`);
          }
        } catch (err) {
          console.error(`[backfill] failed for job ${job.id}:`, err);
        }
      }));
    }

    return c.json({ total: liJobs.length, updated });
  } catch (err) {
    console.error('[backfill] error:', err);
    return c.json({ error: String(err) }, 500);
  }
});

app.get('/api/admin/linkedin-queries', (c) => {
  return c.json({
    maxQueries: MAX_QUERIES,
    active: SEARCH_QUERIES.length,
    queries: SEARCH_QUERIES.map((q) => ({
      keywords: q.keywords,
      jobType: q.jobType,
      defaultCategory: q.defaultCategory,
    })),
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('[api] unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Cloudflare Worker + scheduled cron ───────────────────────────────────────

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCronTick(env, event.cron));
  },
};
