import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

export function verifyCronSecret(c: {
  env: Env;
  req: { header: (name: string) => string | undefined };
}): boolean {
  const secret = c.env.CRON_SECRET;
  if (!secret) return false;
  const auth = c.req.header('Authorization');
  if (auth === `Bearer ${secret}`) return true;
  return c.req.header('X-Cron-Secret') === secret;
}

export const requireCronSecret = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    if (!verifyCronSecret(c)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
    return;
  },
);

function adminEmails(env: Env): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const requireAdmin = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    if (verifyCronSecret(c)) {
      await next();
      return;
    }

    const allowed = adminEmails(c.env);
    const email = c.get('user')?.email?.toLowerCase();
    if (allowed.length > 0 && email && allowed.includes(email)) {
      await next();
      return;
    }

    return c.json({ error: 'Forbidden' }, 403);
  },
);
