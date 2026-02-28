import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import {
  CreateApplicationSchema,
  UpdateApplicationStatusSchema,
  ApplicationsQuerySchema,
  CreateDraftSchema,
  ApproveDraftSchema,
} from '@applyme/shared/schemas';
import { applicationExpiresAt, draftExpiresAt, queueExpiresAt } from '@applyme/shared/utils';
import { isTier1Company } from '@applyme/shared/tier1Companies';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const drafts = new Hono<{ Bindings: Env; Variables: Variables }>();

drafts.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const rows = await db.query.applicationDrafts.findMany({
    where: eq(schema.applicationDrafts.userId, userId),
    with: { job: true },
    orderBy: [desc(schema.applicationDrafts.createdAt)],
  });

  return c.json(rows);
});

drafts.get('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const draft = await db.query.applicationDrafts.findFirst({
    where: and(eq(schema.applicationDrafts.id, id), eq(schema.applicationDrafts.userId, userId)),
    with: { job: true },
  });

  if (!draft) return c.json({ error: 'Not found' }, 404);
  return c.json(draft);
});

drafts.post('/', zValidator('json', CreateDraftSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, body.jobId) });
  if (!job) return c.json({ error: 'Job not found' }, 404);

  const watchlistItem = await db.query.watchlistItems.findFirst({
    where: eq(schema.watchlistItems.value, job.company),
  });

  const requiresApproval =
    watchlistItem?.companyTier === 'tier1' || isTier1Company(job.company);

  const applyMethod =
    job.applyType === 'email' ? 'email' :
    job.sourceType === 'ashby' || job.sourceType === 'lever' || job.sourceType === 'greenhouse'
      ? 'ats_api'
      : 'autofill_queue';

  const [draft] = await db
    .insert(schema.applicationDrafts)
    .values({
      userId,
      jobId: body.jobId,
      resumeVersionId: body.resumeVersionId,
      coverLetter: body.coverLetter,
      qaBundle: body.qaBundle,
      status: 'pending',
      requiresApproval,
      applyMethod,
      expiresAt: draftExpiresAt(),
    })
    .returning();

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'draft_created',
    metadata: { draftId: draft!.id, jobId: body.jobId, requiresApproval },
  });

  return c.json(draft, 201);
});

drafts.post('/:id/approve', zValidator('json', ApproveDraftSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const draft = await db.query.applicationDrafts.findFirst({
    where: and(eq(schema.applicationDrafts.id, id), eq(schema.applicationDrafts.userId, userId)),
    with: { job: true },
  });

  if (!draft) return c.json({ error: 'Not found' }, 404);
  if (draft.status === 'sent') return c.json({ error: 'Already sent' }, 400);

  const resumeVersionId = body.resumeVersionId ?? draft.resumeVersionId;
  const coverLetter = body.coverLetter ?? draft.coverLetter;

  // Build submitted data snapshot
  const resumeVersion = await db.query.resumeVersions.findFirst({
    where: eq(schema.resumeVersions.id, resumeVersionId),
  });

  const submittedData = {
    name: c.get('user').name ?? c.get('user').email,
    email: c.get('user').email,
    resumeVersionId,
    resumeVersionLabel: resumeVersion?.versionLabel ?? 'Unknown',
    coverLetter,
    answers: (draft.qaBundle as { answers: unknown[] }).answers ?? [],
    timestamp: new Date().toISOString(),
    applyMethod: draft.applyMethod,
    applyUrl: draft.job?.applyUrl ?? '',
  };

  if (draft.applyMethod === 'autofill_queue') {
    // Path B: add to autofill queue
    await db.insert(schema.autofillQueue).values({
      userId,
      jobId: draft.jobId,
      draftId: id,
      applyUrl: draft.job?.applyUrl ?? '',
      atsType: detectAtsType(draft.job?.applyUrl ?? ''),
      fieldMap: {
        fields: buildFieldMap(submittedData),
        atsType: detectAtsType(draft.job?.applyUrl ?? ''),
        domain: extractDomain(draft.job?.applyUrl ?? ''),
        learnedAt: null,
      },
      status: 'pending',
      expiresAt: queueExpiresAt(),
    });

    await db
      .update(schema.applicationDrafts)
      .set({ status: 'queued_autofill' })
      .where(eq(schema.applicationDrafts.id, id));

    return c.json({ status: 'queued_autofill', message: 'Added to autofill queue' });
  }

  // Path A: email or ATS API — auto-apply
  const [application] = await db
    .insert(schema.applications)
    .values({
      userId,
      jobId: draft.jobId,
      draftId: id,
      status: 'applied',
      appliedAt: new Date(),
      applyMethod: draft.applyMethod as string,
      submittedData,
      expiresAt: applicationExpiresAt(),
    })
    .returning();

  await db
    .update(schema.applicationDrafts)
    .set({ status: 'sent' })
    .where(eq(schema.applicationDrafts.id, id));

  await db.insert(schema.applicationTimeline).values({
    applicationId: application!.id,
    eventType: 'applied',
    payload: { method: draft.applyMethod },
  });

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'application_created',
    metadata: { applicationId: application!.id, draftId: id, method: draft.applyMethod },
  });

  return c.json({ status: 'applied', application });
});

drafts.post('/:id/send-email', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  if (c.env.EMAIL_ENABLED !== 'true') {
    return c.json({ error: 'Email apply is not enabled' }, 400);
  }

  const draft = await db.query.applicationDrafts.findFirst({
    where: and(eq(schema.applicationDrafts.id, id), eq(schema.applicationDrafts.userId, userId)),
    with: { job: true },
  });

  if (!draft || !draft.job) return c.json({ error: 'Not found' }, 404);
  if (draft.job.applyType !== 'email' || !draft.job.applyEmail) {
    return c.json({ error: 'Job does not support email apply' }, 400);
  }

  // Send via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `ApplyMe <noreply@applyme.app>`,
      to: draft.job.applyEmail,
      subject: `Application for ${draft.job.title} at ${draft.job.company}`,
      text: draft.coverLetter,
    }),
  });

  if (!emailRes.ok) return c.json({ error: 'Email send failed' }, 500);

  return c.json({ ok: true });
});

// ─── Applications ──────────────────────────────────────────────────────────────

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

// ─── Autofill Queue ────────────────────────────────────────────────────────────

const autofillQueue = new Hono<{ Bindings: Env; Variables: Variables }>();

autofillQueue.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const rows = await db.query.autofillQueue.findMany({
    where: and(
      eq(schema.autofillQueue.userId, userId),
      eq(schema.autofillQueue.status, 'pending'),
    ),
    with: { job: true },
    orderBy: [desc(schema.autofillQueue.createdAt)],
  });

  return c.json(rows);
});

autofillQueue.get('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const item = await db.query.autofillQueue.findFirst({
    where: and(eq(schema.autofillQueue.id, id), eq(schema.autofillQueue.userId, userId)),
    with: { job: true, draft: true },
  });

  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(item);
});

autofillQueue.post('/:id/complete', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const item = await db.query.autofillQueue.findFirst({
    where: and(eq(schema.autofillQueue.id, id), eq(schema.autofillQueue.userId, userId)),
    with: { draft: true, job: true },
  });

  if (!item) return c.json({ error: 'Not found' }, 404);

  const submittedData = {
    name: c.get('user').name ?? c.get('user').email,
    email: c.get('user').email,
    resumeVersionId: item.draft?.resumeVersionId ?? '',
    resumeVersionLabel: 'Autofilled',
    coverLetter: item.draft?.coverLetter ?? '',
    answers: (item.draft?.qaBundle as { answers: unknown[] })?.answers ?? [],
    timestamp: new Date().toISOString(),
    applyMethod: 'autofill_queue' as const,
    applyUrl: item.applyUrl,
  };

  const [application] = await db
    .insert(schema.applications)
    .values({
      userId,
      jobId: item.jobId,
      draftId: item.draftId,
      status: 'applied',
      submittedData,
      applyMethod: 'autofill_queue',
      expiresAt: applicationExpiresAt(),
    })
    .returning();

  await db
    .update(schema.autofillQueue)
    .set({ status: 'completed' })
    .where(eq(schema.autofillQueue.id, id));

  await db.insert(schema.applicationTimeline).values({
    applicationId: application!.id,
    eventType: 'applied',
    payload: { method: 'autofill_queue', atsType: item.atsType },
  });

  return c.json({ ok: true, application });
});

autofillQueue.post('/:id/skip', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const item = await db.query.autofillQueue.findFirst({
    where: and(eq(schema.autofillQueue.id, id), eq(schema.autofillQueue.userId, userId)),
  });
  if (!item) return c.json({ error: 'Not found' }, 404);

  await db.delete(schema.autofillQueue).where(eq(schema.autofillQueue.id, id));
  return c.json({ ok: true });
});

autofillQueue.delete('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  await db
    .delete(schema.autofillQueue)
    .where(and(eq(schema.autofillQueue.id, id), eq(schema.autofillQueue.userId, userId)));

  return c.json({ ok: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectAtsType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('workday')) return 'workday';
  if (lower.includes('greenhouse.io')) return 'greenhouse';
  if (lower.includes('lever.co')) return 'lever';
  if (lower.includes('ashbyhq.com')) return 'ashby';
  if (lower.includes('taleo')) return 'taleo';
  if (lower.includes('icims')) return 'icims';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('indeed.com')) return 'indeed';
  return 'unknown';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function buildFieldMap(data: {
  name: string;
  email: string;
  coverLetter: string;
}): Array<{ fieldKey: string; selector: null; label: string; profileValue: string; inputType: string }> {
  const nameParts = data.name.trim().split(' ');
  return [
    { fieldKey: 'first_name', selector: null, label: 'First Name', profileValue: nameParts[0] ?? '', inputType: 'text' },
    { fieldKey: 'last_name', selector: null, label: 'Last Name', profileValue: nameParts.slice(1).join(' '), inputType: 'text' },
    { fieldKey: 'email', selector: null, label: 'Email', profileValue: data.email, inputType: 'email' },
    { fieldKey: 'cover_letter', selector: null, label: 'Cover Letter', profileValue: data.coverLetter, inputType: 'textarea' },
  ];
}

export { drafts, applications, autofillQueue };
