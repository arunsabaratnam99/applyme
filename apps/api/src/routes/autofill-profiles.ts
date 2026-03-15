import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import {
  UpdateAutofillProfileSchema,
  ReportUnknownFieldSchema,
  ToggleAllAutofillSchema,
} from '@applyme/shared/schemas';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const ATS_TYPES = [
  'greenhouse', 'lever', 'ashby', 'workday',
  'linkedin', 'indeed', 'icims', 'taleo', 'unknown',
] as const;

const autofillProfiles = new Hono<{ Bindings: Env; Variables: Variables }>();

autofillProfiles.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  const rows = await db.query.autofillProfiles.findMany({
    where: eq(schema.autofillProfiles.userId, userId),
  });

  const profileMap = Object.fromEntries(rows.map((r) => [r.atsType, r]));

  const settingsFields = {
    name: profile?.displayName ?? null,
    email: null,
    phone: profile?.phone ?? null,
    visaAuth: profile?.visaAuth ?? null,
    linkedinUrl: profile?.linkedinUrl ?? null,
    githubUrl: profile?.githubUrl ?? null,
    websiteUrl: profile?.websiteUrl ?? null,
  };

  const result = ATS_TYPES.map((atsType) => {
    const row = profileMap[atsType];
    return {
      atsType,
      enabled: row?.enabled ?? true,
      fieldOverrides: (row?.fieldOverrides ?? {}) as Record<string, string>,
      unknownFields: (row?.unknownFields ?? []) as Array<{ fieldKey: string; label: string; userValue: string }>,
      settingsFields,
      updatedAt: row?.updatedAt ?? null,
    };
  });

  return c.json(result);
});

autofillProfiles.get('/:atsType', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { atsType } = c.req.param();

  const [profile, row] = await Promise.all([
    db.query.userProfiles.findFirst({ where: eq(schema.userProfiles.userId, userId) }),
    db.query.autofillProfiles.findFirst({
      where: and(
        eq(schema.autofillProfiles.userId, userId),
        eq(schema.autofillProfiles.atsType, atsType),
      ),
    }),
  ]);

  const settingsFields = {
    name: profile?.displayName ?? null,
    phone: profile?.phone ?? null,
    visaAuth: profile?.visaAuth ?? null,
    linkedinUrl: profile?.linkedinUrl ?? null,
    githubUrl: profile?.githubUrl ?? null,
    websiteUrl: profile?.websiteUrl ?? null,
  };

  return c.json({
    atsType,
    enabled: row?.enabled ?? true,
    fieldOverrides: (row?.fieldOverrides ?? {}) as Record<string, string>,
    unknownFields: (row?.unknownFields ?? []) as Array<{ fieldKey: string; label: string; userValue: string }>,
    settingsFields,
    updatedAt: row?.updatedAt ?? null,
  });
});

autofillProfiles.put('/:atsType', zValidator('json', UpdateAutofillProfileSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { atsType } = c.req.param();
  const body = c.req.valid('json');

  const existing = await db.query.autofillProfiles.findFirst({
    where: and(
      eq(schema.autofillProfiles.userId, userId),
      eq(schema.autofillProfiles.atsType, atsType),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(schema.autofillProfiles)
      .set({
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.fieldOverrides !== undefined ? { fieldOverrides: body.fieldOverrides } : {}),
        ...(body.unknownFields !== undefined ? { unknownFields: body.unknownFields } : {}),
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.autofillProfiles.userId, userId),
        eq(schema.autofillProfiles.atsType, atsType),
      ))
      .returning();
    return c.json(updated);
  }

  const [inserted] = await db
    .insert(schema.autofillProfiles)
    .values({
      userId,
      atsType,
      enabled: body.enabled ?? true,
      fieldOverrides: body.fieldOverrides ?? {},
      unknownFields: body.unknownFields ?? [],
    })
    .returning();
  return c.json(inserted, 201);
});

autofillProfiles.post('/toggle-all', zValidator('json', ToggleAllAutofillSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { enabled } = c.req.valid('json');

  await db
    .update(schema.userProfiles)
    .set({ quickApplyAll: enabled, updatedAt: new Date() })
    .where(eq(schema.userProfiles.userId, userId));

  await db
    .update(schema.autofillProfiles)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(schema.autofillProfiles.userId, userId));

  return c.json({ ok: true, enabled });
});

autofillProfiles.post('/:atsType/unknown-field', zValidator('json', ReportUnknownFieldSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { atsType } = c.req.param();
  const { fieldKey, label } = c.req.valid('json');

  const existing = await db.query.autofillProfiles.findFirst({
    where: and(
      eq(schema.autofillProfiles.userId, userId),
      eq(schema.autofillProfiles.atsType, atsType),
    ),
  });

  const currentFields = (existing?.unknownFields ?? []) as Array<{ fieldKey: string; label: string; userValue: string }>;
  const alreadyKnown = currentFields.some((f) => f.fieldKey === fieldKey);
  if (alreadyKnown) return c.json({ ok: true, added: false });

  const newFields = [...currentFields, { fieldKey, label, userValue: '' }];

  if (existing) {
    await db
      .update(schema.autofillProfiles)
      .set({ unknownFields: newFields, updatedAt: new Date() })
      .where(and(
        eq(schema.autofillProfiles.userId, userId),
        eq(schema.autofillProfiles.atsType, atsType),
      ));
  } else {
    await db
      .insert(schema.autofillProfiles)
      .values({ userId, atsType, unknownFields: newFields });
  }

  return c.json({ ok: true, added: true });
});

export { autofillProfiles };
