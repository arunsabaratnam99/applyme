import { Hono } from 'hono';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { JobsQuerySchema } from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';
import { resolveLinkedInApplyUrl } from '../applicators/browser.js';

// ─── In-memory salary cache ───────────────────────────────────────────────────
const salaryCache = new Map<string, { data: SalaryResult; expiresAt: number }>();

interface SalaryResult {
  min: number | null;
  max: number | null;
  median: number | null;
  currency: string;
  source: 'linkedin' | 'job_posting' | null;
}

async function fetchLinkedInSalary(title: string, location: string): Promise<SalaryResult | null> {
  try {
    const query = encodeURIComponent(`${title} ${location}`);
    const url = `https://www.linkedin.com/salary/search?keywords=${query}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Parse salary ranges from LinkedIn salary page JSON-LD or inline data
    const salaryMatch = html.match(/"salaryMedian"\s*:\s*(\d+)/);
    const minMatch = html.match(/"salaryMin"\s*:\s*(\d+)/);
    const maxMatch = html.match(/"salaryMax"\s*:\s*(\d+)/);

    if (!salaryMatch && !minMatch) return null;

    return {
      min: minMatch ? parseInt(minMatch[1]!) : null,
      max: maxMatch ? parseInt(maxMatch[1]!) : null,
      median: salaryMatch ? parseInt(salaryMatch[1]!) : null,
      currency: 'CAD',
      source: 'linkedin',
    };
  } catch {
    return null;
  }
}

const jobs = new Hono<{ Bindings: Env; Variables: Variables }>();

jobs.get('/', zValidator('query', JobsQuerySchema), async (c) => {
  const db = c.get('db');
  const { page, limit, category, employmentType, workplaceType } = c.req.valid('query');
  const offset = (page - 1) * limit;

  const conditions = [];
  if (category) {
    conditions.push(
      Array.isArray(category)
        ? inArray(schema.jobs.jobCategory, category)
        : eq(schema.jobs.jobCategory, category),
    );
  }
  if (employmentType) {
    conditions.push(
      Array.isArray(employmentType)
        ? inArray(schema.jobs.employmentType, employmentType)
        : eq(schema.jobs.employmentType, employmentType),
    );
  }
  if (workplaceType) conditions.push(eq(schema.jobs.workplaceType, workplaceType));

  const rows = await db.query.jobs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(schema.jobs.createdAt), desc(schema.jobs.postedAt)],
    limit,
    offset,
  });

  return c.json({ jobs: rows, page, limit });
});

jobs.get('/salary', async (c) => {
  const title = c.req.query('title') ?? '';
  const location = c.req.query('location') ?? '';
  const jobId = c.req.query('jobId');

  const cacheKey = `${title}__${location}`.toLowerCase();
  const now = Date.now();
  const cached = salaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return c.json(cached.data);
  }

  // Try LinkedIn first
  const li = await fetchLinkedInSalary(title, location);
  if (li) {
    salaryCache.set(cacheKey, { data: li, expiresAt: now + 60 * 60 * 1000 });
    return c.json(li);
  }

  // Fall back to job record salary
  if (jobId) {
    const db = c.get('db');
    const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
    if (job?.salaryMin || job?.salaryMax) {
      const result: SalaryResult = {
        min: job.salaryMin ? parseInt(job.salaryMin) : null,
        max: job.salaryMax ? parseInt(job.salaryMax) : null,
        median: null,
        currency: 'CAD',
        source: 'job_posting',
      };
      salaryCache.set(cacheKey, { data: result, expiresAt: now + 60 * 60 * 1000 });
      return c.json(result);
    }
  }

  const empty: SalaryResult = { min: null, max: null, median: null, currency: 'CAD', source: null };
  return c.json(empty);
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

jobs.get('/:id/resolve-apply-url', async (c) => {
  const db = c.get('db');
  const { id } = c.req.param();

  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, id) });
  if (!job) return c.json({ error: 'Not found' }, 404);

  const isLinkedIn = /linkedin\.com/i.test(job.applyUrl);
  if (!isLinkedIn) {
    return c.json({ applyUrl: job.applyUrl });
  }

  const resolved = await resolveLinkedInApplyUrl(job.jobUrl).catch((err) => {
    console.error(`[resolve-apply-url] resolver threw for job ${id}: ${err}`);
    return null;
  });

  // Cache the resolved URL back to the DB so future clicks are instant
  if (resolved && resolved !== job.applyUrl) {
    db.update(schema.jobs)
      .set({ applyUrl: resolved })
      .where(eq(schema.jobs.id, id))
      .catch(() => {});
  }

  return c.json({ applyUrl: resolved ?? job.applyUrl });
});

export { jobs };
