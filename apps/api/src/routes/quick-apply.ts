import { Hono } from 'hono';
import { eq, and, gt } from 'drizzle-orm';
import { schema } from '@applyme/db';
import { applicationExpiresAt } from '@applyme/shared/utils';
import type { Env, Variables } from '../types.js';

const quickApply = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── ATS detection (mirrors applicators/index.ts) ─────────────────────────────

function detectAtsFromUrl(url: string): string {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (/myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com/.test(hostname)) return 'workday';
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(hostname)) return 'greenhouse';
  if (/jobs\.lever\.co/.test(hostname)) return 'lever';
  if (/jobs\.ashbyhq\.com|boards\.ashbyhq\.com/.test(hostname)) return 'ashby';
  if (/\.taleo\.net/.test(hostname)) return 'taleo';
  if (/\.icims\.com/.test(hostname)) return 'icims';
  if (/\.linkedin\.com/.test(hostname)) return 'linkedin';
  if (/\.indeed\.com/.test(hostname)) return 'indeed';
  if (/\.workable\.com/.test(hostname)) return 'workable';
  if (/\.smartrecruiters\.com/.test(hostname)) return 'smartrecruiters';
  if (/\.jobvite\.com/.test(hostname)) return 'jobvite';
  if (/\.successfactors\.com/.test(hostname)) return 'successfactors';
  if (/jobs\.gc\.ca|emplois\.gc\.ca/.test(hostname)) return 'jobbank_ca';
  return 'unknown';
}

// ─── Build fieldMap from user profile ─────────────────────────────────────────

function buildFieldMap(
  profile: typeof schema.userProfiles.$inferSelect | null | undefined,
  user: { email: string; name: string | null },
  atsType: string,
  applyUrl: string,
) {
  const nameParts = (profile?.displayName ?? user.name ?? '').trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');
  const email = profile?.applyEmail ?? user.email ?? '';
  const phone = profile?.phone ?? '';
  const location = (profile?.locations as string[] | null)?.[0] ?? '';
  const linkedinUrl = profile?.linkedinUrl ?? '';
  const githubUrl = profile?.githubUrl ?? '';
  const websiteUrl = profile?.websiteUrl ?? '';

  let domain = '';
  try {
    domain = new URL(applyUrl).hostname;
  } catch { /* ignore */ }

  return {
    fields: [
      { fieldKey: 'first_name',   selector: null, label: 'First Name',  profileValue: firstName,   inputType: 'text' },
      { fieldKey: 'last_name',    selector: null, label: 'Last Name',   profileValue: lastName,    inputType: 'text' },
      { fieldKey: 'email',        selector: null, label: 'Email',       profileValue: email,       inputType: 'email' },
      { fieldKey: 'phone',        selector: null, label: 'Phone',       profileValue: phone,       inputType: 'tel' },
      { fieldKey: 'location',     selector: null, label: 'Location',    profileValue: location,    inputType: 'text' },
      { fieldKey: 'linkedin_url', selector: null, label: 'LinkedIn',    profileValue: linkedinUrl, inputType: 'url' },
      { fieldKey: 'github_url',   selector: null, label: 'GitHub',      profileValue: githubUrl,   inputType: 'url' },
      { fieldKey: 'website_url',  selector: null, label: 'Website',     profileValue: websiteUrl,  inputType: 'url' },
    ],
    atsType,
    domain,
    learnedAt: null,
  };
}

// ─── POST / — enqueue a quick-apply item ──────────────────────────────────────

quickApply.post('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const sessionUser = c.get('user');

  const body = await c.req.json<{ jobId: string }>().catch(() => null);
  if (!body?.jobId) return c.json({ error: 'jobId is required' }, 400);

  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, body.jobId) });
  if (!job) return c.json({ error: 'Job not found' }, 404);

  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  const atsType = detectAtsFromUrl(job.applyUrl);
  const fieldMap = buildFieldMap(profile, sessionUser, atsType, job.applyUrl);

  const [item] = await db
    .insert(schema.autofillQueue)
    .values({
      userId,
      jobId: job.id,
      applyUrl: job.applyUrl,
      atsType,
      fieldMap,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning();

  return c.json({ id: item!.id, applyUrl: job.applyUrl, atsType }, 201);
});

// ─── GET /queue — extension polls this for pending items ──────────────────────

quickApply.get('/queue', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const items = await db.query.autofillQueue.findMany({
    where: and(
      eq(schema.autofillQueue.userId, userId),
      eq(schema.autofillQueue.status, 'pending'),
      gt(schema.autofillQueue.expiresAt, new Date()),
    ),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  return c.json({ items });
});

// ─── PATCH /:id — extension marks item done or failed ─────────────────────────

quickApply.patch('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const body = await c.req.json<{ status: 'done' | 'failed'; errorDetail?: string }>().catch(() => null);
  if (!body?.status) return c.json({ error: 'status is required' }, 400);

  const item = await db.query.autofillQueue.findFirst({
    where: and(eq(schema.autofillQueue.id, id), eq(schema.autofillQueue.userId, userId)),
  });
  if (!item) return c.json({ error: 'Not found' }, 404);

  const [updated] = await db
    .update(schema.autofillQueue)
    .set({
      status: body.status,
      errorDetail: body.errorDetail ?? null,
      attemptedAt: new Date(),
      attemptCount: item.attemptCount + 1,
    })
    .where(eq(schema.autofillQueue.id, id))
    .returning();

  return c.json(updated);
});

export { quickApply };
