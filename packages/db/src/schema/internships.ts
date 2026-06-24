import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { jobs } from './jobs';

// Per-user GitHub repositories to ingest internship/new-grad listings from.
// Default/built-in repos live in code (apps/api/src/connectors/github.ts);
// this table holds repos a user added on top of those defaults, and lets the
// user disable any repo (including built-ins by storing an override row).
export const internshipSources = pgTable(
  'internship_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    label: text('label'),
    isInternship: boolean('is_internship').notNull().default(true),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('internship_sources_user_id_idx').on(table.userId),
    userRepoUq: uniqueIndex('internship_sources_user_repo_uq').on(
      table.userId,
      table.owner,
      table.repo,
    ),
  }),
);

// Bookmarked / saved jobs (used by the Internships > Saved sub-tab, but
// scoped generally to any job).
export const savedJobs = pgTable(
  'saved_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('saved_jobs_user_id_idx').on(table.userId),
    userJobUq: uniqueIndex('saved_jobs_user_job_uq').on(table.userId, table.jobId),
  }),
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const internshipSourcesRelations = relations(internshipSources, ({ one }) => ({
  user: one(users, { fields: [internshipSources.userId], references: [users.id] }),
}));

export const savedJobsRelations = relations(savedJobs, ({ one }) => ({
  user: one(users, { fields: [savedJobs.userId], references: [users.id] }),
  job: one(jobs, { fields: [savedJobs.jobId], references: [jobs.id] }),
}));
