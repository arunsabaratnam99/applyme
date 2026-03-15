import { createMiddleware } from 'hono/factory';
import { createDb, createPool } from '@applyme/db';
import type { Env, Variables } from '../types.js';

export const withDb = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const pool = createPool(c.env.DATABASE_URL);
    const db = createDb(pool);
    c.set('db', db);
    try {
      await next();
    } finally {
      await pool.end();
    }
  },
);
