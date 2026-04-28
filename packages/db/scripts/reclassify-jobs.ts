/**
 * Re-classifies employment_type for all existing jobs using the same
 * keyword logic as classifyEmploymentType() in @applyme/shared/classify.
 *
 * Run with:  npx tsx scripts/reclassify-jobs.ts
 */
import { neonConfig, neon } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = false;

const DB_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://applyme:applyme@localhost:5432/applyme';

const sql = neon(DB_URL);

// ─── Mirror of classifyEmploymentType from packages/shared/src/classify.ts ───

const SENIOR_SIGNALS = [
  'senior', 'sr.', 'sr ', 'lead', 'principal', 'staff', 'director',
  'manager', 'head of', 'vp ', 'vice president',
];

const CO_OP_KEYWORDS = ['co-op', 'coop', 'co op', 'cooperative education'];

const INTERNSHIP_KEYWORDS = [
  'intern', 'internship',
  'student', 'practicum', 'trainee',
  'placement', 'work term',
];

const NEW_GRAD_KEYWORDS = [
  'new grad', 'new graduate', 'junior', 'entry level', 'entry-level',
  'early career',
];

function classifyEmploymentType(title: string): string {
  const lower = title.toLowerCase();
  if (SENIOR_SIGNALS.some((kw) => lower.includes(kw))) return 'full_time';
  if (CO_OP_KEYWORDS.some((kw) => lower.includes(kw))) return 'co_op';
  if (INTERNSHIP_KEYWORDS.some((kw) => lower.includes(kw))) return 'internship';
  if (NEW_GRAD_KEYWORDS.some((kw) => lower.includes(kw))) return 'internship';
  return 'full_time';
}

// ─── Fetch all jobs and reclassify ───────────────────────────────────────────

const rows = (await sql`SELECT id, title, employment_type FROM jobs`) as {
  id: string;
  title: string;
  employment_type: string;
}[];

console.log(`Found ${rows.length} jobs to reclassify…`);

let updated = 0;
let unchanged = 0;

for (const row of rows) {
  const newType = classifyEmploymentType(row.title);
  if (newType !== row.employment_type) {
    await sql`UPDATE jobs SET employment_type = ${newType} WHERE id = ${row.id}`;
    console.log(`  ${row.title}  →  ${row.employment_type} → ${newType}`);
    updated++;
  } else {
    unchanged++;
  }
}

console.log(`\n✓ Done. Updated: ${updated}  Unchanged: ${unchanged}`);
process.exit(0);
