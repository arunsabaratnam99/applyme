import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDb } from '@applyme/db';
import { withDb } from './middleware/db.js';
import { requireAuth } from './middleware/auth.js';
import { auth } from './routes/auth.js';
import { profile } from './routes/profile.js';
import { resumes } from './routes/resumes.js';
import { jobs, matches } from './routes/jobs.js';
import { drafts, applications, autofillQueue } from './routes/applications.js';
import { watchlist } from './routes/watchlist.js';
import { notifications } from './routes/notifications.js';
import { runCronTick } from './cron/tick.js';
import type { Env, Variables } from './types.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use('*', logger());

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const appBase = c.env?.APP_BASE_URL ?? 'http://localhost:3000';
      return origin === appBase ? origin : appBase;
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

// ─── Protected routes ─────────────────────────────────────────────────────────

app.use('/api/*', requireAuth);

app.route('/api/profile', profile);
app.route('/api/resumes', resumes);
app.route('/api/jobs', jobs);
app.route('/api/matches', matches);
app.route('/api/drafts', drafts);
app.route('/api/applications', applications);
app.route('/api/autofill-queue', autofillQueue);
app.route('/api/watchlist', watchlist);
app.route('/api/notifications', notifications);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('[api] unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Cloudflare Worker + scheduled cron ───────────────────────────────────────

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCronTick(env));
  },
};
