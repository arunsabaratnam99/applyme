import { createMiddleware } from 'hono/factory';
import { createDb } from '@applyme/db';
import type { Env, Variables } from '../types.js';

export const withDb = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const db = createDb(c.env.DATABASE_URL);
    c.set('db', db);
    await next();
  },
);
