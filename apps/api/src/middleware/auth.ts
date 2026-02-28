import { createMiddleware } from 'hono/factory';
import { SignJWT, jwtVerify } from 'jose';
import type { Env, Variables } from '../types.js';

const COOKIE_NAME = 'am_session';

export interface SessionPayload {
  sub: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const key = await importSecret(secret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifySession(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const key = await importSecret(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

async function importSecret(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export function setSessionCookie(token: string, isProd: boolean): string {
  const flags = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=604800',
    isProd ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
  return flags;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const token = getSessionToken(c.req.raw);
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const payload = await verifySession(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    c.set('userId', payload.sub);
    c.set('user', {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
    });

    await next();
  },
);
