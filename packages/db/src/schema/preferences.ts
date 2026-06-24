import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Per-user, per-table view preferences (column visibility/order/widths and
// the active sort). The `config` JSON shape is validated by
// `TablePreferencesSchema` in @applyme/shared.
export const userTablePreferences = pgTable(
  'user_table_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableKey: text('table_key').notNull(),
    config: jsonb('config').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userTableUq: uniqueIndex('user_table_preferences_user_table_uq').on(
      table.userId,
      table.tableKey,
    ),
  }),
);

export const userTablePreferencesRelations = relations(userTablePreferences, ({ one }) => ({
  user: one(users, { fields: [userTablePreferences.userId], references: [users.id] }),
}));
