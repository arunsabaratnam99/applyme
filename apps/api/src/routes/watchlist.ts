import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { AddWatchlistItemSchema, UpdateWatchlistItemSchema } from '@applyme/shared/schemas';
import { getPeersForCompany, isTier1Company } from '@applyme/shared';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const watchlist = new Hono<{ Bindings: Env; Variables: Variables }>();

async function getOrCreateWatchlist(db: ReturnType<typeof import('@applyme/db')['createDb']>, userId: string) {
  const existing = await db.query.watchlists.findFirst({
    where: eq(schema.watchlists.userId, userId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(schema.watchlists)
    .values({ userId, label: 'My Watchlist' })
    .returning();
  return created!;
}

watchlist.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const wl = await db.query.watchlists.findFirst({
    where: eq(schema.watchlists.userId, userId),
    with: { items: true },
  });

  if (!wl) return c.json({ items: [], peerMap: {} });

  // Attach static peers for each company item
  const peerMap: Record<string, ReturnType<typeof getPeersForCompany>> = {};
  for (const item of wl.items) {
    if (item.itemType === 'company') {
      peerMap[item.id] = getPeersForCompany(item.value);
    }
  }

  return c.json({ ...wl, peerMap });
});

watchlist.post('/items', zValidator('json', AddWatchlistItemSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const wl = await getOrCreateWatchlist(db, userId);

  // Auto-detect tier for companies
  const companyTier =
    body.itemType === 'company' && isTier1Company(body.value)
      ? 'tier1'
      : (body.companyTier ?? 'standard');

  const [item] = await db
    .insert(schema.watchlistItems)
    .values({
      watchlistId: wl.id,
      itemType: body.itemType,
      value: body.value,
      atsUrl: body.atsUrl ?? null,
      companyTier,
      autoDiscoverPeers: body.autoDiscoverPeers ?? false,
    })
    .returning();

  const peers = body.itemType === 'company' ? getPeersForCompany(body.value) : [];
  return c.json({ item, peers }, 201);
});

watchlist.patch('/items/:id', zValidator('json', UpdateWatchlistItemSchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const wl = await db.query.watchlists.findFirst({
    where: eq(schema.watchlists.userId, userId),
  });
  if (!wl) return c.json({ error: 'Not found' }, 404);

  const item = await db.query.watchlistItems.findFirst({
    where: and(eq(schema.watchlistItems.id, id), eq(schema.watchlistItems.watchlistId, wl.id)),
  });
  if (!item) return c.json({ error: 'Not found' }, 404);

  const updateData: Record<string, unknown> = {};
  if (body.companyTier !== undefined) updateData['companyTier'] = body.companyTier;
  if (body.autoDiscoverPeers !== undefined) updateData['autoDiscoverPeers'] = body.autoDiscoverPeers;
  if (body.atsUrl !== undefined) updateData['atsUrl'] = body.atsUrl;

  const [updated] = await db
    .update(schema.watchlistItems)
    .set(updateData)
    .where(eq(schema.watchlistItems.id, id))
    .returning();

  return c.json(updated);
});

watchlist.delete('/items/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const wl = await db.query.watchlists.findFirst({
    where: eq(schema.watchlists.userId, userId),
  });
  if (!wl) return c.json({ error: 'Not found' }, 404);

  await db
    .delete(schema.watchlistItems)
    .where(and(eq(schema.watchlistItems.id, id), eq(schema.watchlistItems.watchlistId, wl.id)));

  return c.json({ ok: true });
});

watchlist.get('/items/:id/peers', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const wl = await db.query.watchlists.findFirst({
    where: eq(schema.watchlists.userId, userId),
  });
  if (!wl) return c.json({ error: 'Not found' }, 404);

  const item = await db.query.watchlistItems.findFirst({
    where: and(eq(schema.watchlistItems.id, id), eq(schema.watchlistItems.watchlistId, wl.id)),
  });
  if (!item) return c.json({ error: 'Not found' }, 404);

  const peers = getPeersForCompany(item.value);
  return c.json({ peers });
});

watchlist.post('/items/:id/peers/:peer/add', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id, peer } = c.req.param();

  const wl = await db.query.watchlists.findFirst({
    where: eq(schema.watchlists.userId, userId),
  });
  if (!wl) return c.json({ error: 'Not found' }, 404);

  const anchorItem = await db.query.watchlistItems.findFirst({
    where: and(eq(schema.watchlistItems.id, id), eq(schema.watchlistItems.watchlistId, wl.id)),
  });
  if (!anchorItem) return c.json({ error: 'Not found' }, 404);

  const peerName = decodeURIComponent(peer);

  const [newItem] = await db
    .insert(schema.watchlistItems)
    .values({
      watchlistId: wl.id,
      itemType: 'company',
      value: peerName,
      companyTier: isTier1Company(peerName) ? 'tier1' : 'standard',
      autoDiscoverPeers: false,
    })
    .returning();

  await db.insert(schema.notifications).values({
    userId,
    type: 'peer_added',
    payload: {
      message: `Added ${peerName} to your watchlist because you watch ${anchorItem.value}`,
      anchorCompany: anchorItem.value,
      peerCompany: peerName,
    },
  });

  return c.json({ item: newItem }, 201);
});

export { watchlist };
