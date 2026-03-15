import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from './schema/index.js';

// In Node environments (scripts/migrations) use the ws package.
// In Cloudflare Workers the global WebSocket is available.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require('ws');
} catch {
  neonConfig.webSocketConstructor = WebSocket;
}

export type Database = NeonDatabase<typeof schema>;

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

export function createDb(databaseUrl: string): Database;
export function createDb(pool: Pool): Database;
export function createDb(arg: string | Pool): Database {
  const pool = typeof arg === 'string' ? new Pool({ connectionString: arg }) : arg;
  return drizzle(pool, { schema });
}

export { schema };
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
