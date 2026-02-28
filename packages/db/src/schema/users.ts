import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const userOauthIdentities = pgTable('user_oauth_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  locations: jsonb('locations').notNull().default([]),
  preferredRemote: boolean('preferred_remote').notNull().default(false),
  salaryMin: text('salary_min'),
  salaryMax: text('salary_max'),
  visaAuth: text('visa_auth'),
  keywords: jsonb('keywords').notNull().default([]),
  roles: jsonb('roles').notNull().default([]),
  excludeKeywords: jsonb('exclude_keywords').notNull().default([]),
  country: text('country').notNull().default('CA'),
  jobCategories: jsonb('job_categories').notNull().default(['software', 'business']),
  employmentTypes: jsonb('employment_types').notNull().default(['full_time', 'internship', 'co_op']),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  oauthIdentities: many(userOauthIdentities),
}));

export const userOauthIdentitiesRelations = relations(userOauthIdentities, ({ one }) => ({
  user: one(users, { fields: [userOauthIdentities.userId], references: [users.id] }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));
