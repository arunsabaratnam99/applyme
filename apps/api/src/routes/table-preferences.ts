import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { TablePreferencesSchema } from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const tablePreferences = new Hono<{ Bindings: Env; Variables: Variables }>();

const TABLE_KEY_RE = /^[a-z][a-z0-9_-]{0,79}$/;

// GET /api/table-preferences/:tableKey — returns saved config or null.
tablePreferences.get('/:tableKey', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { tableKey } = c.req.param();

  if (!TABLE_KEY_RE.test(tableKey)) {
    return c.json({ error: 'Invalid tableKey' }, 400);
  }

  const row = await db.query.userTablePreferences.findFirst({
    where: and(
      eq(schema.userTablePreferences.userId, userId),
      eq(schema.userTablePreferences.tableKey, tableKey),
    ),
  });

  if (!row) return c.json({ config: null });
  return c.json({ config: row.config });
});

// PUT /api/table-preferences/:tableKey — upsert preferences for this user/table.
tablePreferences.put('/:tableKey', zValidator('json', TablePreferencesSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { tableKey } = c.req.param();
  const config = c.req.valid('json');

  if (!TABLE_KEY_RE.test(tableKey)) {
    return c.json({ error: 'Invalid tableKey' }, 400);
  }

  const existing = await db.query.userTablePreferences.findFirst({
    where: and(
      eq(schema.userTablePreferences.userId, userId),
      eq(schema.userTablePreferences.tableKey, tableKey),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(schema.userTablePreferences)
      .set({ config, updatedAt: new Date() })
      .where(eq(schema.userTablePreferences.id, existing.id))
      .returning();
    return c.json({ config: updated!.config });
  }

  const [inserted] = await db
    .insert(schema.userTablePreferences)
    .values({ userId, tableKey, config })
    .returning();

  return c.json({ config: inserted!.config }, 201);
});

export { tablePreferences };
