import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres.atxfejnbzffnhgreynsm:P6NSGHUxwvJNqben@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require',
  },
} satisfies Config;
