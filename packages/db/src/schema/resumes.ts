import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const resumes = pgTable(
  'resumes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('resumes_user_id_idx').on(table.userId),
  }),
);

export const resumeVersions = pgTable(
  'resume_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    versionLabel: text('version_label').notNull(),
    r2Key: text('r2_key').notNull(),
    mimeType: text('mime_type').notNull().default('application/pdf'),
    fileSizeBytes: text('file_size_bytes'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    resumeIdIdx: index('resume_versions_resume_id_idx').on(table.resumeId),
  }),
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const resumesRelations = relations(resumes, ({ one, many }) => ({
  user: one(users, { fields: [resumes.userId], references: [users.id] }),
  versions: many(resumeVersions),
}));

export const resumeVersionsRelations = relations(resumeVersions, ({ one }) => ({
  resume: one(resumes, { fields: [resumeVersions.resumeId], references: [resumes.id] }),
}));
