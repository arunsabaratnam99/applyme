import { neonConfig, neon } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = false;

const DB_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://applyme:applyme@localhost:5432/applyme';

const sql = neon(DB_URL);

const sources = [
  'linkedin_scraper',
  'indeed_scraper',
  'remotive',
  'jobbank_ca',
  'github_repo',
  'workatastartup',
];

for (const sourceType of sources) {
  await sql(
    `INSERT INTO job_sources (source_type, config, enabled)
     VALUES ($1, '{}'::jsonb, true)
     ON CONFLICT DO NOTHING`,
    [sourceType],
  );
  console.log(`✓ ${sourceType}`);
}

console.log('Done seeding job_sources');
process.exit(0);
