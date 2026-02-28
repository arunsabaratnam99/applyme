import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { jobs } from './jobs.js';

export const jobMatches = pgTable(
  'job_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    reasons: jsonb('reasons').notNull().default([]),
    dismissed: boolean('dismissed').notNull().default(false),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('job_matches_user_id_idx').on(table.userId),
    scoreIdx: index('job_matches_score_idx').on(table.score),
    userJobIdx: index('job_matches_user_job_idx').on(table.userId, table.jobId),
  }),
);

export const applicationDrafts = pgTable(
  'application_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    resumeVersionId: uuid('resume_version_id').notNull(),
    coverLetter: text('cover_letter').notNull().default(''),
    qaBundle: jsonb('qa_bundle').notNull().default({ answers: [] }),
    status: text('status').notNull().default('pending'),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    applyMethod: text('apply_method').notNull().default('url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('drafts_user_id_idx').on(table.userId),
    statusIdx: index('drafts_status_idx').on(table.status),
  }),
);

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    draftId: uuid('draft_id').references(() => applicationDrafts.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('applied'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
    submittedData: jsonb('submitted_data').notNull().default({}),
    applyMethod: text('apply_method').notNull().default('manual'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('applications_user_id_idx').on(table.userId),
    statusIdx: index('applications_status_idx').on(table.status),
    appliedAtIdx: index('applications_applied_at_idx').on(table.appliedAt),
  }),
);

export const applicationTimeline = pgTable(
  'application_timeline',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    applicationIdIdx: index('timeline_application_id_idx').on(table.applicationId),
  }),
);

export const autofillQueue = pgTable(
  'autofill_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => applicationDrafts.id, { onDelete: 'cascade' }),
    applyUrl: text('apply_url').notNull(),
    atsType: text('ats_type').notNull().default('unknown'),
    fieldMap: jsonb('field_map').notNull().default({ fields: [], atsType: 'unknown', domain: '', learnedAt: null }),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('autofill_user_id_idx').on(table.userId),
    statusIdx: index('autofill_status_idx').on(table.status),
    expiresAtIdx: index('autofill_expires_at_idx').on(table.expiresAt),
    pendingIdx: index('autofill_pending_idx').on(table.userId, table.status),
  }),
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const jobMatchesRelations = relations(jobMatches, ({ one }) => ({
  user: one(users, { fields: [jobMatches.userId], references: [users.id] }),
  job: one(jobs, { fields: [jobMatches.jobId], references: [jobs.id] }),
}));

export const applicationDraftsRelations = relations(applicationDrafts, ({ one, many }) => ({
  user: one(users, { fields: [applicationDrafts.userId], references: [users.id] }),
  job: one(jobs, { fields: [applicationDrafts.jobId], references: [jobs.id] }),
  applications: many(applications),
  autofillItems: many(autofillQueue),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  job: one(jobs, { fields: [applications.jobId], references: [jobs.id] }),
  draft: one(applicationDrafts, { fields: [applications.draftId], references: [applicationDrafts.id] }),
  timeline: many(applicationTimeline),
}));

export const applicationTimelineRelations = relations(applicationTimeline, ({ one }) => ({
  application: one(applications, { fields: [applicationTimeline.applicationId], references: [applications.id] }),
}));

export const autofillQueueRelations = relations(autofillQueue, ({ one }) => ({
  user: one(users, { fields: [autofillQueue.userId], references: [users.id] }),
  job: one(jobs, { fields: [autofillQueue.jobId], references: [jobs.id] }),
  draft: one(applicationDrafts, { fields: [autofillQueue.draftId], references: [applicationDrafts.id] }),
}));
