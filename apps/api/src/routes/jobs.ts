import { Hono } from 'hono';
import { eq, desc, and, gte } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { JobsQuerySchema, MatchesQuerySchema } from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const jobs = new Hono<{ Bindings: Env; Variables: Variables }>();

jobs.get('/', zValidator('query', JobsQuerySchema), async (c) => {
  const db = c.get('db');
  const { page, limit, category, employmentType, workplaceType } = c.req.valid('query');
  const offset = (page - 1) * limit;

  const conditions = [eq(schema.jobs.country, 'CA')];
  if (category) conditions.push(eq(schema.jobs.jobCategory, category));
  if (employmentType) conditions.push(eq(schema.jobs.employmentType, employmentType));
  if (workplaceType) conditions.push(eq(schema.jobs.workplaceType, workplaceType));

  const rows = await db.query.jobs.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.jobs.postedAt), desc(schema.jobs.createdAt)],
    limit,
    offset,
  });

  return c.json({ jobs: rows, page, limit });
});

jobs.get('/:id', async (c) => {
  const db = c.get('db');
  const { id } = c.req.param();

  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, id),
  });

  if (!job) return c.json({ error: 'Not found' }, 404);
  return c.json(job);
});

// ─── Matches ──────────────────────────────────────────────────────────────────

const matches = new Hono<{ Bindings: Env; Variables: Variables }>();

matches.get('/', zValidator('query', MatchesQuerySchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { page, limit, minScore } = c.req.valid('query');
  const offset = (page - 1) * limit;

  const conditions = [
    eq(schema.jobMatches.userId, userId),
    eq(schema.jobMatches.dismissed, false),
  ];
  if (minScore !== undefined) conditions.push(gte(schema.jobMatches.score, minScore));

  const rows = await db.query.jobMatches.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.jobMatches.score), desc(schema.jobMatches.createdAt)],
    with: { job: true },
    limit,
    offset,
  });

  return c.json({ matches: rows, page, limit });
});

matches.post('/:id/dismiss', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const match = await db.query.jobMatches.findFirst({
    where: and(eq(schema.jobMatches.id, id), eq(schema.jobMatches.userId, userId)),
  });
  if (!match) return c.json({ error: 'Not found' }, 404);

  await db
    .update(schema.jobMatches)
    .set({ dismissed: true })
    .where(eq(schema.jobMatches.id, id));

  return c.json({ ok: true });
});

export { jobs, matches };
