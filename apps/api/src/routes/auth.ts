import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import type { Env, Variables } from '../types.js';
import {
  signSession,
  clearSessionCookie,
} from '../middleware/auth.js';
import { resolveOrigin } from '../utils/origin.js';
import { schema } from '@applyme/db';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

const OAUTH_STATE_COOKIE = 'oauth_state';

function oauthStateCookieFlags(env: Env): string {
  const isProd = !env.APP_BASE_URL.startsWith('http://localhost');
  return `HttpOnly; SameSite=Lax; Path=/auth; Max-Age=600${isProd ? '; Secure' : ''}`;
}

function setOAuthStateCookie(nonce: string, env: Env): string {
  return `${OAUTH_STATE_COOKIE}=${nonce}; ${oauthStateCookieFlags(env)}`;
}

function clearOAuthStateCookie(env: Env): string {
  return `${OAUTH_STATE_COOKIE}=; ${oauthStateCookieFlags(env)}; Max-Age=0`;
}

function readOAuthStateCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${OAUTH_STATE_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

function parseOAuthState(state: string | undefined): { nonce?: string; origin?: string } | null {
  try {
    return JSON.parse(atob(state ?? '')) as { nonce?: string; origin?: string };
  } catch {
    return null;
  }
}

function verifyOAuthState(request: Request, state: string | undefined, env: Env): string | null {
  const parsed = parseOAuthState(state);
  const storedNonce = readOAuthStateCookie(request);
  if (!parsed?.nonce || !storedNonce || parsed.nonce !== storedNonce) {
    return null;
  }
  return resolveOrigin(parsed.origin, env);
}

function sessionCompleteUrl(origin: string, token: string): string {
  return `${origin}/auth/complete#token=${encodeURIComponent(token)}`;
}

function redirectWithCookie(
  c: { header: (name: string, value: string) => void; redirect: (url: string, status?: 302) => Response },
  url: string,
  cookie: string,
): Response {
  c.header('Set-Cookie', cookie);
  return c.redirect(url, 302);
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

auth.get('/google', (c) => {
  const origin = resolveOrigin(c.req.query('origin'), c.env);
  const nonce = crypto.randomUUID();
  const state = btoa(JSON.stringify({ nonce, origin }));
  const apiBase = c.env.API_BASE_URL ?? 'http://localhost:8787';
  const params = new URLSearchParams({
    client_id: c.env.OAUTH_GOOGLE_CLIENT_ID,
    redirect_uri: `${apiBase}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return redirectWithCookie(
    c,
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    setOAuthStateCookie(nonce, c.env),
  );
});

auth.get('/google/callback', async (c) => {
  const { state, code } = c.req.query();
  const origin = verifyOAuthState(c.req.raw, state, c.env) ?? c.env.APP_BASE_URL;
  const clearCookie = clearOAuthStateCookie(c.env);

  const redirectError = (msg: string) =>
    redirectWithCookie(c, `${origin}/api/auth/callback?error=${encodeURIComponent(msg)}`, clearCookie);

  try {
    if (!verifyOAuthState(c.req.raw, state, c.env)) {
      return redirectError('Invalid OAuth state');
    }
    if (!code) return redirectError('Missing code');

    const apiBase = c.env.API_BASE_URL ?? 'http://localhost:8787';
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.OAUTH_GOOGLE_CLIENT_ID,
        client_secret: c.env.OAUTH_GOOGLE_CLIENT_SECRET,
        redirect_uri: `${apiBase}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) return redirectError('Token exchange failed');

    const tokens = await tokenRes.json() as { access_token: string; id_token: string };

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) return redirectError('Profile fetch failed');

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

    return redirectWithCookie(c, sessionCompleteUrl(origin, token), clearCookie);
  } catch (err) {
    console.error('[google/callback] error:', err);
    return redirectError(err instanceof Error ? err.message : 'Unknown error');
  }
});

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

auth.get('/github', (c) => {
  const origin = resolveOrigin(c.req.query('origin'), c.env);
  const nonce = crypto.randomUUID();
  const state = btoa(JSON.stringify({ nonce, origin }));
  const apiBase = c.env.API_BASE_URL ?? 'http://localhost:8787';
  const params = new URLSearchParams({
    client_id: c.env.OAUTH_GITHUB_CLIENT_ID,
    redirect_uri: `${apiBase}/auth/github/callback`,
    scope: 'read:user user:email',
    state,
  });
  return redirectWithCookie(
    c,
    `https://github.com/login/oauth/authorize?${params}`,
    setOAuthStateCookie(nonce, c.env),
  );
});

auth.get('/github/callback', async (c) => {
  const { code, state } = c.req.query();
  const clearCookie = clearOAuthStateCookie(c.env);
  const origin = verifyOAuthState(c.req.raw, state, c.env) ?? c.env.APP_BASE_URL;

  if (!verifyOAuthState(c.req.raw, state, c.env)) {
    return redirectWithCookie(
      c,
      `${origin}/api/auth/callback?error=${encodeURIComponent('Invalid OAuth state')}`,
      clearCookie,
    );
  }
  if (!code) {
    return redirectWithCookie(
      c,
      `${origin}/api/auth/callback?error=${encodeURIComponent('Missing code')}`,
      clearCookie,
    );
  }

  const apiBase = c.env.API_BASE_URL ?? 'http://localhost:8787';
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
      redirect_uri: `${apiBase}/auth/github/callback`,
    }),
  });

  const tokens = await tokenRes.json() as { access_token: string };
  if (!tokens.access_token) {
    return redirectWithCookie(
      c,
      `${origin}/api/auth/callback?error=${encodeURIComponent('Token exchange failed')}`,
      clearCookie,
    );
  }

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
  if (!primary) {
    return redirectWithCookie(
      c,
      `${origin}/api/auth/callback?error=${encodeURIComponent('No verified email')}`,
      clearCookie,
    );
  }

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

  return redirectWithCookie(c, sessionCompleteUrl(origin, token), clearCookie);
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
  const existing = await db.query.userOauthIdentities.findFirst({
    where: and(
      eq(schema.userOauthIdentities.provider, params.provider),
      eq(schema.userOauthIdentities.providerId, params.providerId),
    ),
    with: { user: true },
  });

  if (existing?.user) {
    await db
      .update(schema.userOauthIdentities)
      .set({ accessToken: params.accessToken, updatedAt: new Date() })
      .where(eq(schema.userOauthIdentities.id, existing.id));
    return existing.user;
  }

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

    await db.insert(schema.userProfiles).values({ userId: user.id }).onConflictDoNothing();
    await db.insert(schema.watchlists).values({ userId: user.id, label: 'My Watchlist' });
  }

  await db.insert(schema.userOauthIdentities).values({
    userId: user.id,
    provider: params.provider,
    providerId: params.providerId,
    accessToken: params.accessToken,
  });

  return user;
}

export { auth };
