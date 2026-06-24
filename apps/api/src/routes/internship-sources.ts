import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { schema } from '@applyme/db';
import { DEFAULT_GITHUB_REPOS } from '../connectors/github.js';
import type { Env, Variables } from '../types.js';

const internshipSources = new Hono<{ Bindings: Env; Variables: Variables }>();

const AddRepoSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  label: z.string().max(120).optional(),
  isInternship: z.boolean().optional(),
});

const UpdateRepoSchema = z.object({
  enabled: z.boolean().optional(),
  label: z.string().max(120).nullable().optional(),
});

const OWNER_REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-_.]{0,99})$/;

function validIdent(s: string): boolean {
  return OWNER_REPO_RE.test(s);
}

// Verify the repo actually has data the connector can parse. We try
// listings.json on each fallback branch first; if all fail we accept the repo
// when its README.md is reachable (the parser handles the HTML-table case).
async function validateRepoReachable(owner: string, repo: string): Promise<{ ok: boolean; reason?: string }> {
  const BRANCHES = ['dev', 'main', 'master'];
  for (const branch of BRANCHES) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.github/scripts/listings.json`,
        { headers: { 'User-Agent': 'applyme-job-aggregator/1.0' } },
      );
      if (res.ok) return { ok: true };
    } catch {
      // continue
    }
  }
  for (const branch of BRANCHES) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
        { headers: { 'User-Agent': 'applyme-job-aggregator/1.0' } },
      );
      if (res.ok) return { ok: true };
    } catch {
      // continue
    }
  }
  return { ok: false, reason: 'Could not fetch listings.json or README.md from any of dev/main/master branches.' };
}

// GET /api/internship-sources — list built-in defaults plus this user's
// custom repos. Built-ins are returned with `builtIn: true` so the UI can
// render them differently (read-only, but toggleable in the future).
internshipSources.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const userRepos = await db.query.internshipSources.findMany({
    where: eq(schema.internshipSources.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const builtIn = DEFAULT_GITHUB_REPOS.map((r) => ({
    id: `builtin:${r.owner}/${r.repo}`,
    owner: r.owner,
    repo: r.repo,
    label: null as string | null,
    isInternship: r.isInternship,
    enabled: true,
    builtIn: true,
    createdAt: null as string | null,
  }));

  const custom = userRepos.map((r) => ({
    id: r.id,
    owner: r.owner,
    repo: r.repo,
    label: r.label,
    isInternship: r.isInternship,
    enabled: r.enabled,
    builtIn: false,
    createdAt: r.createdAt.toISOString(),
  }));

  return c.json({ sources: [...custom, ...builtIn] });
});

// POST /api/internship-sources — add a repo. Accepts either an owner/repo
// pair or a github URL (the client is expected to parse the URL first; this
// route always takes the structured form).
internshipSources.post('/', zValidator('json', AddRepoSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const owner = body.owner.trim();
  const repo = body.repo.trim();

  if (!validIdent(owner) || !validIdent(repo)) {
    return c.json({ error: 'Invalid owner/repo format.' }, 400);
  }

  // Reject duplicates of built-ins to keep the cron list clean.
  const isBuiltIn = DEFAULT_GITHUB_REPOS.some(
    (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase(),
  );
  if (isBuiltIn) {
    return c.json({ error: 'That repository is already a built-in source.' }, 409);
  }

  const existing = await db.query.internshipSources.findFirst({
    where: and(
      eq(schema.internshipSources.userId, userId),
      eq(schema.internshipSources.owner, owner),
      eq(schema.internshipSources.repo, repo),
    ),
  });
  if (existing) {
    return c.json({ error: 'You have already added this repository.' }, 409);
  }

  const check = await validateRepoReachable(owner, repo);
  if (!check.ok) {
    return c.json({ error: check.reason ?? 'Repository is not reachable.' }, 422);
  }

  const [row] = await db
    .insert(schema.internshipSources)
    .values({
      userId,
      owner,
      repo,
      label: body.label ?? null,
      isInternship: body.isInternship ?? true,
      enabled: true,
    })
    .returning();

  return c.json({ source: row }, 201);
});

// PATCH /api/internship-sources/:id — toggle enable/disable or relabel.
internshipSources.patch('/:id', zValidator('json', UpdateRepoSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const row = await db.query.internshipSources.findFirst({
    where: and(
      eq(schema.internshipSources.id, id),
      eq(schema.internshipSources.userId, userId),
    ),
  });
  if (!row) return c.json({ error: 'Not found' }, 404);

  const updates: Record<string, unknown> = {};
  if (body.enabled !== undefined) updates['enabled'] = body.enabled;
  if (body.label !== undefined) updates['label'] = body.label;
  if (Object.keys(updates).length === 0) return c.json({ source: row });

  const [updated] = await db
    .update(schema.internshipSources)
    .set(updates)
    .where(eq(schema.internshipSources.id, id))
    .returning();

  return c.json({ source: updated });
});

internshipSources.delete('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  await db
    .delete(schema.internshipSources)
    .where(
      and(
        eq(schema.internshipSources.id, id),
        eq(schema.internshipSources.userId, userId),
      ),
    );

  return c.json({ ok: true });
});

// GET /api/internship-sources/search?q=... — proxy to GitHub's repo search.
// We add a sensible default qualifier so a bare "summer 2026" actually
// returns internship-style repos. Returns a minimal projection that's safe
// to render without further fetching.
internshipSources.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (!q) return c.json({ items: [] });

  const qualified = q.includes('in:name')
    ? q
    : `${q} internships in:name,description,readme`;

  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(qualified)}&per_page=15&sort=stars&order=desc`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'applyme-job-aggregator/1.0',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      return c.json({ items: [], error: `GitHub search failed (${res.status})` }, 200);
    }
    const data = (await res.json()) as {
      items?: Array<{
        full_name: string;
        owner: { login: string };
        name: string;
        description: string | null;
        stargazers_count: number;
        html_url: string;
        pushed_at: string;
      }>;
    };
    const items = (data.items ?? []).map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      fullName: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      htmlUrl: r.html_url,
      pushedAt: r.pushed_at,
    }));
    return c.json({ items });
  } catch (err) {
    console.error('[internship-sources/search] error:', err);
    return c.json({ items: [], error: 'Search failed' }, 200);
  }
});

export { internshipSources };
