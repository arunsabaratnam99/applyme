import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { UpdateProfileSchema } from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Env, Variables } from '../types.js';

function getS3(env: Env) {
  return new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const profile = new Hono<{ Bindings: Env; Variables: Variables }>();

profile.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const p = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  return c.json(p ?? null);
});

profile.put('/', zValidator('json', UpdateProfileSchema, (result, c) => {
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ error: msg }, 400) as any;
  }
}), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const raw = c.req.valid('json');
  // Strip keys whose value is undefined to satisfy Drizzle's exactOptionalPropertyTypes
  const body = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as typeof raw;

  const updated = await db
    .update(schema.userProfiles)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ ...(body as any), updatedAt: new Date() })
    .where(eq(schema.userProfiles.userId, userId))
    .returning();

  if (!updated[0]) {
    const [inserted] = await db
      .insert(schema.userProfiles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values({ userId, ...(body as any) })
      .returning();
    return c.json(inserted);
  }

  return c.json(updated[0]);
});

profile.get('/me', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const sessionUser = c.get('user');

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
  });

  if (!user) {
    return c.json({
      id: userId,
      email: sessionUser.email,
      name: sessionUser.name,
      avatarUrl: sessionUser.avatarUrl,
    });
  }
  return c.json(user);
});

profile.post('/avatar', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return c.json({ error: 'Only JPEG, PNG, WebP, or GIF images are supported' }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'Image must be under 5 MB' }, 400);
  }

  const ext = file.type.split('/')[1] ?? 'jpg';
  const r2Key = `avatars/${userId}.${ext}`;

  const s3 = getS3(c.env);
  const buffer = await file.arrayBuffer();
  await s3.send(new PutObjectCommand({
    Bucket: c.env.R2_BUCKET_NAME,
    Key: r2Key,
    Body: new Uint8Array(buffer),
    ContentType: file.type,
    CacheControl: 'public, max-age=31536000',
  }));

  const publicUrl = `${c.env.R2_PUBLIC_URL}/${r2Key}`;

  // Upsert profile with customAvatarUrl
  const existing = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  if (existing) {
    await db
      .update(schema.userProfiles)
      .set({ customAvatarUrl: publicUrl, updatedAt: new Date() })
      .where(eq(schema.userProfiles.userId, userId));
  } else {
    await db
      .insert(schema.userProfiles)
      .values({ userId, customAvatarUrl: publicUrl });
  }

  return c.json({ avatarUrl: publicUrl });
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
