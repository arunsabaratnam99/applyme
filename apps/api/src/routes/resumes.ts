import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { CreateResumeSchema, CreateResumeVersionSchema } from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env, Variables } from '../types.js';

const resumes = new Hono<{ Bindings: Env; Variables: Variables }>();

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

resumes.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const rows = await db.query.resumes.findMany({
    where: eq(schema.resumes.userId, userId),
    with: { versions: true },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  return c.json(rows);
});

resumes.post('/', zValidator('json', CreateResumeSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // If isDefault, unset others
  if (body.isDefault) {
    await db
      .update(schema.resumes)
      .set({ isDefault: false })
      .where(eq(schema.resumes.userId, userId));
  }

  const [resume] = await db
    .insert(schema.resumes)
    .values({ userId, label: body.label, isDefault: body.isDefault ?? false })
    .returning();

  return c.json(resume, 201);
});

resumes.delete('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const resume = await db.query.resumes.findFirst({
    where: and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)),
    with: { versions: true },
  });

  if (!resume) return c.json({ error: 'Not found' }, 404);

  const s3 = getS3(c.env);
  await Promise.all(
    resume.versions.map((v) =>
      s3.send(new DeleteObjectCommand({ Bucket: c.env.R2_BUCKET_NAME, Key: v.r2Key })),
    ),
  );

  await db.delete(schema.resumes).where(eq(schema.resumes.id, id));

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'resume_deleted',
    metadata: { resumeId: id },
  });

  return c.json({ ok: true });
});

resumes.post('/:id/versions', zValidator('json', CreateResumeVersionSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const resume = await db.query.resumes.findFirst({
    where: and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)),
  });
  if (!resume) return c.json({ error: 'Not found' }, 404);

  const r2Key = `resumes/${userId}/${id}/${crypto.randomUUID()}.pdf`;

  if (body.isDefault) {
    await db
      .update(schema.resumeVersions)
      .set({ isDefault: false })
      .where(eq(schema.resumeVersions.resumeId, id));
  }

  const [version] = await db
    .insert(schema.resumeVersions)
    .values({
      resumeId: id,
      versionLabel: body.versionLabel,
      r2Key,
      mimeType: body.mimeType,
      fileSizeBytes: String(body.fileSizeBytes),
      isDefault: body.isDefault ?? false,
    })
    .returning();

  const s3 = getS3(c.env);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: c.env.R2_BUCKET_NAME,
      Key: r2Key,
      ContentType: body.mimeType,
    }),
    { expiresIn: 300 },
  );

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'resume_uploaded',
    metadata: { resumeId: id, versionId: version!.id },
  });

  return c.json({ version, uploadUrl }, 201);
});

resumes.get('/:id/versions/:vid/download', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id, vid } = c.req.param();

  const resume = await db.query.resumes.findFirst({
    where: and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)),
  });
  if (!resume) return c.json({ error: 'Not found' }, 404);

  const version = await db.query.resumeVersions.findFirst({
    where: and(eq(schema.resumeVersions.id, vid), eq(schema.resumeVersions.resumeId, id)),
  });
  if (!version) return c.json({ error: 'Not found' }, 404);

  const s3 = getS3(c.env);
  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: c.env.R2_BUCKET_NAME, Key: version.r2Key }),
    { expiresIn: 900 },
  );

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'resume_downloaded',
    metadata: { resumeId: id, versionId: vid },
  });

  return c.json({ downloadUrl });
});

export { resumes };
