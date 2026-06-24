import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { schema } from '@applyme/db';
import type { Database } from '@applyme/db';
import type { Env, Variables } from '../types.js';

const insights = new Hono<{ Bindings: Env; Variables: Variables }>();

interface SankeyNode {
  id: string;
}
interface SankeyLink {
  source: string;
  target: string;
  value: number;
}
interface SankeyResponse {
  nodes: SankeyNode[];
  links: SankeyLink[];
  empty: boolean;
}

// Bucket a status string into one of four end-state buckets. Anything we
// don't recognise is grouped under "Active" so the diagram never has a
// dangling row.
function bucketStatus(status: string): 'Applied' | 'Interview' | 'Offer' | 'Rejected' | 'Active' {
  const s = status.toLowerCase();
  if (/(offer|hired|accepted)/.test(s)) return 'Offer';
  if (/(reject|withdraw|closed|declined)/.test(s)) return 'Rejected';
  if (/(interview|onsite|phone[\s_-]?screen|technical|assessment)/.test(s)) return 'Interview';
  if (s === 'applied') return 'Applied';
  return 'Active';
}

const SOURCE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  linkedin_scraper: 'LinkedIn',
  indeed: 'Indeed',
  indeed_scraper: 'Indeed',
  github_repo: 'GitHub',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  jobbank_ca: 'Job Bank CA',
  remotive: 'Remotive',
  workatastartup: 'Work at a Startup',
  themuse: 'The Muse',
  arbeitnow: 'Arbeitnow',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  co_op: 'Co-op',
  contract: 'Contract',
};

const CATEGORY_LABELS: Record<string, string> = {
  software: 'Software',
  business: 'Business',
  data: 'Data / ML',
  design: 'Design',
  product: 'Product',
  devops: 'DevOps',
  security: 'Security',
  qa: 'QA',
};

const TOP_COMPANIES = 12;

// Truncate to top-N by total weight, lumping the rest into "Other ($label)".
function topNByWeight<T>(
  items: T[],
  weightOf: (t: T) => number,
  topN: number,
): { kept: T[]; otherWeight: number } {
  const sorted = [...items].sort((a, b) => weightOf(b) - weightOf(a));
  const kept = sorted.slice(0, topN);
  const otherWeight = sorted.slice(topN).reduce((acc, x) => acc + weightOf(x), 0);
  return { kept, otherWeight };
}

interface AppRow {
  status: string;
  appliedAt: Date;
  job: {
    company: string;
    sourceType: string;
    employmentType: string;
    jobCategory: string;
  } | null;
  timeline: Array<{ eventType: string; createdAt: Date }>;
}

async function loadApps(db: Database, userId: string): Promise<AppRow[]> {
  const rows = await db.query.applications.findMany({
    where: eq(schema.applications.userId, userId),
    with: {
      job: {
        columns: {
          company: true,
          sourceType: true,
          employmentType: true,
          jobCategory: true,
        },
      },
      timeline: {
        orderBy: [asc(schema.applicationTimeline.createdAt)],
        columns: { eventType: true, createdAt: true },
      },
    },
  });
  return rows.map((r) => ({
    status: r.status,
    appliedAt: r.appliedAt,
    job: r.job ?? null,
    timeline: r.timeline,
  }));
}

function buildStatusView(apps: AppRow[]): SankeyResponse {
  // Layer 1 = "Applied" (everyone starts here). Layer 2 = first non-applied
  // event bucket from timeline (else current status). Layer 3 = terminal
  // outcome (Offer / Rejected / Active).
  const linkMap = new Map<string, number>();
  const bump = (src: string, dst: string) => {
    if (src === dst) return;
    const key = `${src}\u0000${dst}`;
    linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
  };

  for (const app of apps) {
    const events = app.timeline.map((t) => bucketStatus(t.eventType));
    const finalBucket = bucketStatus(app.status);

    if (events.length === 0) {
      bump('Applied', finalBucket);
      continue;
    }

    // Build a path: Applied -> first non-applied event -> ... -> final bucket
    const path: string[] = ['Applied'];
    for (const evt of events) {
      if (evt !== path[path.length - 1]) path.push(evt);
    }
    if (path[path.length - 1] !== finalBucket) path.push(finalBucket);

    for (let i = 0; i < path.length - 1; i++) {
      bump(path[i]!, path[i + 1]!);
    }
  }

  return toResponse(linkMap);
}

function buildSourceView(apps: AppRow[]): SankeyResponse {
  // Source -> Company (top N) -> Outcome
  const sourceCompany = new Map<string, number>();
  const companyOutcome = new Map<string, number>();
  const companyTotals = new Map<string, number>();

  for (const app of apps) {
    if (!app.job) continue;
    const source = SOURCE_LABELS[app.job.sourceType] ?? app.job.sourceType ?? 'Other';
    const company = app.job.company || 'Unknown';
    const outcome = bucketStatus(app.status);
    companyTotals.set(company, (companyTotals.get(company) ?? 0) + 1);
    sourceCompany.set(`${source}\u0000${company}`, (sourceCompany.get(`${source}\u0000${company}`) ?? 0) + 1);
    companyOutcome.set(`${company}\u0000${outcome}`, (companyOutcome.get(`${company}\u0000${outcome}`) ?? 0) + 1);
  }

  const { kept, otherWeight } = topNByWeight(
    [...companyTotals.entries()],
    ([, w]) => w,
    TOP_COMPANIES,
  );
  const keptCompanies = new Set(kept.map(([name]) => name));

  const linkMap = new Map<string, number>();
  const mapCompany = (c: string) => (keptCompanies.has(c) ? c : 'Other companies');

  for (const [key, w] of sourceCompany) {
    const [source, company] = key.split('\u0000') as [string, string];
    const c = mapCompany(company);
    linkMap.set(`${source}\u0000${c}`, (linkMap.get(`${source}\u0000${c}`) ?? 0) + w);
  }
  for (const [key, w] of companyOutcome) {
    const [company, outcome] = key.split('\u0000') as [string, string];
    const c = mapCompany(company);
    linkMap.set(`${c}\u0000${outcome}`, (linkMap.get(`${c}\u0000${outcome}`) ?? 0) + w);
  }
  if (otherWeight === 0) {
    // ensure no orphan "Other companies" node
    for (const k of [...linkMap.keys()]) {
      if (k.includes('Other companies')) linkMap.delete(k);
    }
  }

  return toResponse(linkMap);
}

function buildCategoryView(apps: AppRow[]): SankeyResponse {
  // Employment Type -> Job Category -> Company (top N) -> Outcome
  const empCat = new Map<string, number>();
  const catCompany = new Map<string, number>();
  const companyOutcome = new Map<string, number>();
  const companyTotals = new Map<string, number>();

  for (const app of apps) {
    if (!app.job) continue;
    const emp = EMPLOYMENT_LABELS[app.job.employmentType] ?? app.job.employmentType ?? 'Other';
    const cat = CATEGORY_LABELS[app.job.jobCategory] ?? app.job.jobCategory ?? 'Other';
    const company = app.job.company || 'Unknown';
    const outcome = bucketStatus(app.status);
    companyTotals.set(company, (companyTotals.get(company) ?? 0) + 1);
    empCat.set(`${emp}\u0000${cat}`, (empCat.get(`${emp}\u0000${cat}`) ?? 0) + 1);
    catCompany.set(`${cat}\u0000${company}`, (catCompany.get(`${cat}\u0000${company}`) ?? 0) + 1);
    companyOutcome.set(`${company}\u0000${outcome}`, (companyOutcome.get(`${company}\u0000${outcome}`) ?? 0) + 1);
  }

  const { kept } = topNByWeight([...companyTotals.entries()], ([, w]) => w, TOP_COMPANIES);
  const keptCompanies = new Set(kept.map(([name]) => name));
  const mapCompany = (c: string) => (keptCompanies.has(c) ? c : 'Other companies');

  const linkMap = new Map<string, number>();
  for (const [key, w] of empCat) {
    linkMap.set(key, (linkMap.get(key) ?? 0) + w);
  }
  for (const [key, w] of catCompany) {
    const [cat, company] = key.split('\u0000') as [string, string];
    const c = mapCompany(company);
    linkMap.set(`${cat}\u0000${c}`, (linkMap.get(`${cat}\u0000${c}`) ?? 0) + w);
  }
  for (const [key, w] of companyOutcome) {
    const [company, outcome] = key.split('\u0000') as [string, string];
    const c = mapCompany(company);
    linkMap.set(`${c}\u0000${outcome}`, (linkMap.get(`${c}\u0000${outcome}`) ?? 0) + w);
  }

  return toResponse(linkMap);
}

function toResponse(linkMap: Map<string, number>): SankeyResponse {
  const nodeSet = new Set<string>();
  const links: SankeyLink[] = [];
  for (const [key, value] of linkMap) {
    if (value <= 0) continue;
    const [source, target] = key.split('\u0000') as [string, string];
    if (!source || !target) continue;
    nodeSet.add(source);
    nodeSet.add(target);
    links.push({ source, target, value });
  }
  const nodes = [...nodeSet].map((id) => ({ id }));
  return { nodes, links, empty: links.length === 0 };
}

insights.get('/sankey', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const view = (c.req.query('view') ?? 'status').toLowerCase();

  const apps = await loadApps(db, userId);

  if (apps.length === 0) {
    return c.json<SankeyResponse>({ nodes: [], links: [], empty: true });
  }

  if (view === 'source') return c.json(buildSourceView(apps));
  if (view === 'category') return c.json(buildCategoryView(apps));
  return c.json(buildStatusView(apps));
});

export { insights };
