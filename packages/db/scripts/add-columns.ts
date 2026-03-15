import { neonConfig, neon } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DB_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres.atxfejnbzffnhgreynsm:P6NSGHUxwvJNqben@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require';

const sql = neon(DB_URL);

await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_avatar_url text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS headline text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS summary text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS years_of_experience integer`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_experience jsonb DEFAULT '[]'::jsonb`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS education jsonb DEFAULT '[]'::jsonb`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS earliest_start_date text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS willing_to_relocate boolean DEFAULT false`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_pronouns text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ethnicity text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS veteran_status text`;
await sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS disability_status text`;

console.log('✓ Columns added (or already existed)');
process.exit(0);
