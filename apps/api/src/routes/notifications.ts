import { Hono } from 'hono';
import { eq, and, isNull } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { PushSubscribeSchema, UpdateNotificationPrefsSchema } from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>();

notifications.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const rows = await db.query.notifications.findMany({
    where: eq(schema.notifications.userId, userId),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
    limit: 50,
  });

  return c.json(rows);
});

notifications.post('/read/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId)));

  return c.json({ ok: true });
});

notifications.post('/subscribe', zValidator('json', PushSubscribeSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  await db
    .insert(schema.pushSubscriptions)
    .values({ userId, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { p256dh: body.p256dh, auth: body.auth },
    });

  return c.json({ ok: true });
});

notifications.delete('/subscribe', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = await c.req.json<{ endpoint: string }>();

  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, userId),
        eq(schema.pushSubscriptions.endpoint, body.endpoint),
      ),
    );

  return c.json({ ok: true });
});

notifications.get('/prefs', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const prefs = await db.query.notificationPrefs.findFirst({
    where: eq(schema.notificationPrefs.userId, userId),
  });

  return c.json(prefs ?? null);
});

notifications.put('/prefs', zValidator('json', UpdateNotificationPrefsSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const [updated] = await db
    .insert(schema.notificationPrefs)
    .values({ userId, ...body })
    .onConflictDoUpdate({
      target: schema.notificationPrefs.userId,
      set: { ...body, updatedAt: new Date() },
    })
    .returning();

  return c.json(updated);
});

export { notifications };
