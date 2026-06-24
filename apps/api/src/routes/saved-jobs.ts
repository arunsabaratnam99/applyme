import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const savedJobs = new Hono<{ Bindings: Env; Variables: Variables }>();

const AddSavedJobSchema = z.object({
  jobId: z.string().uuid(),
});

// GET /api/saved-jobs — list saved jobs with full job rows, newest-saved first.
savedJobs.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const rows = await db.query.savedJobs.findMany({
    where: eq(schema.savedJobs.userId, userId),
    orderBy: [desc(schema.savedJobs.createdAt)],
    with: { job: true },
  });

  const items = rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    createdAt: r.createdAt.toISOString(),
    job: r.job,
  }));

  return c.json({ items });
});

// POST /api/saved-jobs { jobId }
savedJobs.post('/', zValidator('json', AddSavedJobSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { jobId } = c.req.valid('json');

  // Idempotent: re-saving an already-saved job is a no-op.
  const existing = await db.query.savedJobs.findFirst({
    where: and(eq(schema.savedJobs.userId, userId), eq(schema.savedJobs.jobId, jobId)),
  });
  if (existing) {
    return c.json({ item: existing }, 200);
  }

  const [row] = await db
    .insert(schema.savedJobs)
    .values({ userId, jobId })
    .returning();

  return c.json({ item: row }, 201);
});

// DELETE /api/saved-jobs/:jobId — unsave by jobId (simpler for the client than tracking the saved-row id).
savedJobs.delete('/:jobId', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { jobId } = c.req.param();

  await db
    .delete(schema.savedJobs)
    .where(and(eq(schema.savedJobs.userId, userId), eq(schema.savedJobs.jobId, jobId)));

  return c.json({ ok: true });
});

export { savedJobs };
