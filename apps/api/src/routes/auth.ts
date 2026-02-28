import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Env, Variables } from '../types.js';
import {
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/auth.js';
import { schema } from '@applyme/db';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Google OAuth ─────────────────────────────────────────────────────────────

auth.get('/google', (c) => {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: c.env.OAUTH_GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.APP_BASE_URL.replace('3000', '8787')}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

auth.get('/google/callback', async (c) => {
  const { code } = c.req.query();
  if (!code) return c.json({ error: 'Missing code' }, 400);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.OAUTH_GOOGLE_CLIENT_ID,
      client_secret: c.env.OAUTH_GOOGLE_CLIENT_SECRET,
      redirect_uri: `${c.env.APP_BASE_URL.replace('3000', '8787')}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) return c.json({ error: 'Token exchange failed' }, 400);

  const tokens = await tokenRes.json() as { access_token: string; id_token: string };

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return c.json({ error: 'Profile fetch failed' }, 400);

  const profile = await profileRes.json() as {
    sub: string; email: string; name: string; picture: string;
  };

  const db = c.get('db');
  const user = await upsertUser(db, {
    provider: 'google',
    providerId: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
    accessToken: tokens.access_token,
  });

  const token = await signSession(
    { sub: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    c.env.JWT_SECRET,
  );

  const isProd = !c.env.APP_BASE_URL.includes('localhost');
  return c.redirect(c.env.APP_BASE_URL + '/jobs', 302, {
    'Set-Cookie': setSessionCookie(token, isProd),
  });
});

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

auth.get('/github', (c) => {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: c.env.OAUTH_GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.APP_BASE_URL.replace('3000', '8787')}/auth/github/callback`,
    scope: 'read:user user:email',
    state,
  });
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

auth.get('/github/callback', async (c) => {
  const { code } = c.req.query();
  if (!code) return c.json({ error: 'Missing code' }, 400);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: c.env.OAUTH_GITHUB_CLIENT_ID,
      client_secret: c.env.OAUTH_GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${c.env.APP_BASE_URL.replace('3000', '8787')}/auth/github/callback`,
    }),
  });

  const tokens = await tokenRes.json() as { access_token: string };
  if (!tokens.access_token) return c.json({ error: 'Token exchange failed' }, 400);

  const [profileRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'ApplyMe' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'ApplyMe' },
    }),
  ]);

  const ghProfile = await profileRes.json() as { id: number; name: string; avatar_url: string };
  const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
  const primary = emails.find((e) => e.primary && e.verified);
  if (!primary) return c.json({ error: 'No verified email' }, 400);

  const db = c.get('db');
  const user = await upsertUser(db, {
    provider: 'github',
    providerId: String(ghProfile.id),
    email: primary.email,
    name: ghProfile.name,
    avatarUrl: ghProfile.avatar_url,
    accessToken: tokens.access_token,
  });

  const token = await signSession(
    { sub: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    c.env.JWT_SECRET,
  );

  const isProd = !c.env.APP_BASE_URL.includes('localhost');
  return c.redirect(c.env.APP_BASE_URL + '/jobs', 302, {
    'Set-Cookie': setSessionCookie(token, isProd),
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

auth.post('/logout', (c) => {
  return c.json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function upsertUser(
  db: ReturnType<typeof import('@applyme/db')['createDb']>,
  params: {
    provider: string;
    providerId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    accessToken: string;
  },
) {
  // Check for existing identity
  const existing = await db.query.userOauthIdentities.findFirst({
    where: eq(schema.userOauthIdentities.providerId, params.providerId),
    with: { user: true },
  });

  if (existing?.user) {
    // Update access token
    await db
      .update(schema.userOauthIdentities)
      .set({ accessToken: params.accessToken, updatedAt: new Date() })
      .where(eq(schema.userOauthIdentities.id, existing.id));
    return existing.user;
  }

  // Check if user with email exists
  let user = await db.query.users.findFirst({
    where: eq(schema.users.email, params.email),
  });

  if (!user) {
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: params.email,
        name: params.name,
        avatarUrl: params.avatarUrl,
      })
      .returning();
    if (!newUser) throw new Error('Failed to create user');
    user = newUser;

    // Create default profile
    await db.insert(schema.userProfiles).values({ userId: user.id }).onConflictDoNothing();
    // Create default watchlist
    await db.insert(schema.watchlists).values({ userId: user.id, label: 'My Watchlist' });
    // Create default notification prefs
    await db.insert(schema.notificationPrefs).values({ userId: user.id }).onConflictDoNothing();
  }

  // Link identity
  await db.insert(schema.userOauthIdentities).values({
    userId: user.id,
    provider: params.provider,
    providerId: params.providerId,
    accessToken: params.accessToken,
  });

  return user;
}

export { auth };
