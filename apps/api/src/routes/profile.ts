import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { UpdateProfileSchema } from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const profile = new Hono<{ Bindings: Env; Variables: Variables }>();

profile.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const p = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  return c.json(p ?? null);
});

profile.put('/', zValidator('json', UpdateProfileSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const updated = await db
    .update(schema.userProfiles)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(schema.userProfiles.userId, userId))
    .returning();

  if (!updated[0]) {
    // Profile doesn't exist yet — insert it
    const [inserted] = await db
      .insert(schema.userProfiles)
      .values({ userId, ...body })
      .returning();
    return c.json(inserted);
  }

  return c.json(updated[0]);
});

profile.get('/me', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
  });

  if (!user) return c.json({ error: 'Not found' }, 404);
  return c.json(user);
});

profile.delete('/me', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  // Audit log before deletion
  await db.insert(schema.auditLogs).values({
    userId,
    action: 'account_deleted',
    metadata: { redacted: false },
  });

  // Nullify audit log user references
  await db
    .update(schema.auditLogs)
    .set({ userId: null, metadata: { redacted: true } })
    .where(eq(schema.auditLogs.userId, userId));

  // Cascade delete user (all related rows deleted via FK cascade)
  await db.delete(schema.users).where(eq(schema.users.id, userId));

  return c.json({ ok: true }, 200, { 'Set-Cookie': 'am_session=; HttpOnly; Path=/; Max-Age=0' });
});

export { profile };
