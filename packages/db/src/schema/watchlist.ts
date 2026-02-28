import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

export const watchlists = pgTable('watchlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull().default('My Watchlist'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    watchlistId: uuid('watchlist_id')
      .notNull()
      .references(() => watchlists.id, { onDelete: 'cascade' }),
    itemType: text('item_type').notNull(),
    value: text('value').notNull(),
    atsUrl: text('ats_url'),
    companyTier: text('company_tier').notNull().default('standard'),
    autoDiscoverPeers: boolean('auto_discover_peers').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    watchlistIdIdx: index('watchlist_items_watchlist_id_idx').on(table.watchlistId),
  }),
);

export const companyPeers = pgTable(
  'company_peers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    anchorCompany: text('anchor_company').notNull(),
    peerCompany: text('peer_company').notNull(),
    similarityScore: integer('similarity_score').notNull().default(50),
    peerTags: jsonb('peer_tags').notNull().default([]),
    source: text('source').notNull().default('curated'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    anchorIdx: index('company_peers_anchor_idx').on(table.anchorCompany),
  }),
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  user: one(users, { fields: [watchlists.userId], references: [users.id] }),
  items: many(watchlistItems),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, { fields: [watchlistItems.watchlistId], references: [watchlists.id] }),
}));
