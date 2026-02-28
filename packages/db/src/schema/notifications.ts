import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('push_subscriptions_user_id_idx').on(table.userId),
  }),
);

export const notificationPrefs = pgTable('notification_prefs', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(false),
  quietStart: text('quiet_start'),
  quietEnd: text('quiet_end'),
  digestMode: boolean('digest_mode').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    readAtIdx: index('notifications_read_at_idx').on(table.readAt),
  }),
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    processedAtIdx: index('outbox_processed_at_idx').on(table.processedAt),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    action: text('action').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));

export const notificationPrefsRelations = relations(notificationPrefs, ({ one }) => ({
  user: one(users, { fields: [notificationPrefs.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
