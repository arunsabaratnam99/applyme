import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import {
  CreateApplicationSchema,
  UpdateApplicationStatusSchema,
  ApplicationsQuerySchema,
} from '@applyme/shared/schemas';
import { applicationExpiresAt } from '@applyme/shared/utils';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const applications = new Hono<{ Bindings: Env; Variables: Variables }>();

applications.get('/', zValidator('query', ApplicationsQuerySchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { page, limit, status, applyMethod } = c.req.valid('query');
  const offset = (page - 1) * limit;

  const conditions = [eq(schema.applications.userId, userId)];
  if (status) conditions.push(eq(schema.applications.status, status));
  if (applyMethod) conditions.push(eq(schema.applications.applyMethod, applyMethod));

  const rows = await db.query.applications.findMany({
    where: and(...conditions),
    with: { job: true },
    orderBy: [desc(schema.applications.appliedAt)],
    limit,
    offset,
  });

  return c.json({ applications: rows, page, limit });
});

applications.get('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const application = await db.query.applications.findFirst({
    where: and(eq(schema.applications.id, id), eq(schema.applications.userId, userId)),
    with: { job: true, timeline: true },
  });

  if (!application) return c.json({ error: 'Not found' }, 404);
  return c.json(application);
});

applications.delete('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const application = await db.query.applications.findFirst({
    where: and(eq(schema.applications.id, id), eq(schema.applications.userId, userId)),
  });
  if (!application) return c.json({ error: 'Not found' }, 404);

  await db.delete(schema.applications).where(
    and(eq(schema.applications.id, id), eq(schema.applications.userId, userId)),
  );

  return c.json({ ok: true });
});

applications.get('/:id/timeline', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const application = await db.query.applications.findFirst({
    where: and(eq(schema.applications.id, id), eq(schema.applications.userId, userId)),
  });
  if (!application) return c.json({ error: 'Not found' }, 404);

  const timeline = await db.query.applicationTimeline.findMany({
    where: eq(schema.applicationTimeline.applicationId, id),
    orderBy: [desc(schema.applicationTimeline.createdAt)],
  });

  return c.json(timeline);
});

applications.post('/', zValidator('json', CreateApplicationSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, body.jobId) });
  if (!job) return c.json({ error: 'Job not found' }, 404);

  const user = c.get('user');

  const submittedData = {
    name: user.name ?? user.email,
    email: user.email,
    resumeVersionId: '',
    resumeVersionLabel: '',
    coverLetter: '',
    answers: [],
    timestamp: new Date().toISOString(),
    applyMethod: body.applyMethod,
    applyUrl: job.applyUrl,
  };

  const [application] = await db
    .insert(schema.applications)
    .values({
      userId,
      jobId: body.jobId,
      draftId: body.draftId ?? null,
      status: 'applied',
      notes: body.notes ?? null,
      submittedData,
      applyMethod: body.applyMethod,
      expiresAt: applicationExpiresAt(),
    })
    .returning();

  await db.insert(schema.applicationTimeline).values({
    applicationId: application!.id,
    eventType: 'applied',
    payload: { method: body.applyMethod, manual: true },
  });

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'application_created',
    metadata: { applicationId: application!.id, method: body.applyMethod },
  });

  return c.json(application, 201);
});

applications.patch('/:id', zValidator('json', UpdateApplicationStatusSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const application = await db.query.applications.findFirst({
    where: and(eq(schema.applications.id, id), eq(schema.applications.userId, userId)),
  });
  if (!application) return c.json({ error: 'Not found' }, 404);

  const [updated] = await db
    .update(schema.applications)
    .set({ status: body.status, notes: body.notes ?? application.notes })
    .where(eq(schema.applications.id, id))
    .returning();

  await db.insert(schema.applicationTimeline).values({
    applicationId: id,
    eventType: `status_changed_${body.status}`,
    payload: { from: application.status, to: body.status },
  });

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'application_status_changed',
    metadata: { applicationId: id, from: application.status, to: body.status },
  });

  return c.json(updated);
});

export { applications };
