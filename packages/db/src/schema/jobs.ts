import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const jobSources = pgTable('job_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceType: text('source_type').notNull(),
  config: jsonb('config').notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  lastExternalIds: jsonb('last_external_ids').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => jobSources.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    canonicalUrlHash: text('canonical_url_hash').notNull(),
    fingerprint: text('fingerprint').notNull(),
    company: text('company').notNull(),
    title: text('title').notNull(),
    location: text('location').notNull().default(''),
    country: text('country').notNull().default('CA'),
    workplaceType: text('workplace_type'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    descriptionPlain: text('description_plain').notNull().default(''),
    jobUrl: text('job_url').notNull(),
    applyUrl: text('apply_url').notNull(),
    applyType: text('apply_type').notNull().default('url'),
    applyEmail: text('apply_email'),
    sourceType: text('source_type').notNull(),
    jobCategory: text('job_category').notNull(),
    employmentType: text('employment_type').notNull().default('full_time'),
    salaryMin: text('salary_min'),
    salaryMax: text('salary_max'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    canonicalUrlHashUniq: uniqueIndex('jobs_canonical_url_hash_uniq').on(table.canonicalUrlHash),
    fingerprintUniq: uniqueIndex('jobs_fingerprint_uniq').on(table.fingerprint),
    sourceIdIdx: index('jobs_source_id_idx').on(table.sourceId),
    postedAtIdx: index('jobs_posted_at_idx').on(table.postedAt),
    categoryIdx: index('jobs_category_idx').on(table.jobCategory),
    employmentTypeIdx: index('jobs_employment_type_idx').on(table.employmentType),
  }),
);

export const jobRawSnapshots = pgTable('job_raw_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  raw: jsonb('raw').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ─────────────────────────────────────────────────────────────────
// Note: cross-table relations (jobs <-> matches) are defined in schema/index.ts
// to avoid circular imports.

export const jobSourcesRelations = relations(jobSources, ({ many }) => ({
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  source: one(jobSources, { fields: [jobs.sourceId], references: [jobSources.id] }),
  snapshots: many(jobRawSnapshots),
}));

export const jobRawSnapshotsRelations = relations(jobRawSnapshots, ({ one }) => ({
  job: one(jobs, { fields: [jobRawSnapshots.jobId], references: [jobs.id] }),
}));
