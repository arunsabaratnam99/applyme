import { Hono } from 'hono';
import { eq, desc, and, gte, inArray } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { JobsQuerySchema, MatchesQuerySchema, QuickApplySchema } from '@applyme/shared/schemas';
import { draftExpiresAt } from '@applyme/shared/utils';
import { isTier1Company } from '@applyme/shared/tier1Companies';
import { schema } from '@applyme/db';
import type { Env, Variables } from '../types.js';
import { resolveLinkedInApplyUrl } from '../applicators/browser.js';

// ─── In-memory salary cache ───────────────────────────────────────────────────
const salaryCache = new Map<string, { data: SalaryResult; expiresAt: number }>();

interface SalaryResult {
  min: number | null;
  max: number | null;
  median: number | null;
  currency: string;
  source: 'linkedin' | 'job_posting' | null;
}

async function fetchLinkedInSalary(title: string, location: string): Promise<SalaryResult | null> {
  try {
    const query = encodeURIComponent(`${title} ${location}`);
    const url = `https://www.linkedin.com/salary/search?keywords=${query}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Parse salary ranges from LinkedIn salary page JSON-LD or inline data
    const salaryMatch = html.match(/"salaryMedian"\s*:\s*(\d+)/);
    const minMatch = html.match(/"salaryMin"\s*:\s*(\d+)/);
    const maxMatch = html.match(/"salaryMax"\s*:\s*(\d+)/);

    if (!salaryMatch && !minMatch) return null;

    return {
      min: minMatch ? parseInt(minMatch[1]!) : null,
      max: maxMatch ? parseInt(maxMatch[1]!) : null,
      median: salaryMatch ? parseInt(salaryMatch[1]!) : null,
      currency: 'CAD',
      source: 'linkedin',
    };
  } catch {
    return null;
  }
}

const jobs = new Hono<{ Bindings: Env; Variables: Variables }>();

jobs.get('/', zValidator('query', JobsQuerySchema), async (c) => {
  const db = c.get('db');
  const { page, limit, category, employmentType, workplaceType } = c.req.valid('query');
  const offset = (page - 1) * limit;

  const conditions = [];
  if (category) {
    conditions.push(
      Array.isArray(category)
        ? inArray(schema.jobs.jobCategory, category)
        : eq(schema.jobs.jobCategory, category),
    );
  }
  if (employmentType) {
    conditions.push(
      Array.isArray(employmentType)
        ? inArray(schema.jobs.employmentType, employmentType)
        : eq(schema.jobs.employmentType, employmentType),
    );
  }
  if (workplaceType) conditions.push(eq(schema.jobs.workplaceType, workplaceType));

  const rows = await db.query.jobs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(schema.jobs.createdAt), desc(schema.jobs.postedAt)],
    limit,
    offset,
  });

  return c.json({ jobs: rows, page, limit });
});

jobs.get('/salary', async (c) => {
  const title = c.req.query('title') ?? '';
  const location = c.req.query('location') ?? '';
  const jobId = c.req.query('jobId');

  const cacheKey = `${title}__${location}`.toLowerCase();
  const now = Date.now();
  const cached = salaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return c.json(cached.data);
  }

  // Try LinkedIn first
  const li = await fetchLinkedInSalary(title, location);
  if (li) {
    salaryCache.set(cacheKey, { data: li, expiresAt: now + 60 * 60 * 1000 });
    return c.json(li);
  }

  // Fall back to job record salary
  if (jobId) {
    const db = c.get('db');
    const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
    if (job?.salaryMin || job?.salaryMax) {
      const result: SalaryResult = {
        min: job.salaryMin ? parseInt(job.salaryMin) : null,
        max: job.salaryMax ? parseInt(job.salaryMax) : null,
        median: null,
        currency: 'CAD',
        source: 'job_posting',
      };
      salaryCache.set(cacheKey, { data: result, expiresAt: now + 60 * 60 * 1000 });
      return c.json(result);
    }
  }

  const empty: SalaryResult = { min: null, max: null, median: null, currency: 'CAD', source: null };
  return c.json(empty);
});

jobs.get('/:id', async (c) => {
  const db = c.get('db');
  const { id } = c.req.param();

  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, id),
  });

  if (!job) return c.json({ error: 'Not found' }, 404);
  return c.json(job);
});

jobs.get('/:id/resolve-apply-url', async (c) => {
  const db = c.get('db');
  const { id } = c.req.param();

  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, id) });
  if (!job) return c.json({ error: 'Not found' }, 404);

  const isLinkedIn = /linkedin\.com/i.test(job.applyUrl);
  if (!isLinkedIn) {
    return c.json({ applyUrl: job.applyUrl });
  }

  const resolved = await resolveLinkedInApplyUrl(job.jobUrl).catch((err) => {
    console.error(`[resolve-apply-url] resolver threw for job ${id}: ${err}`);
    return null;
  });

  // Cache the resolved URL back to the DB so future clicks are instant
  if (resolved && resolved !== job.applyUrl) {
    db.update(schema.jobs)
      .set({ applyUrl: resolved })
      .where(eq(schema.jobs.id, id))
      .catch(() => {});
  }

  return c.json({ applyUrl: resolved ?? job.applyUrl });
});

// ─── Quick Apply ──────────────────────────────────────────────────────────────

async function generateCoverLetter(
  env: Env,
  jobTitle: string,
  company: string,
  description: string,
  userName: string,
  roles: string[],
  template?: string,
): Promise<string> {
  if (env.AI_ENABLED !== 'true') return '';
  try {
    const system = template
      ? `You are a cover letter writer. Use this template/tone as a guide:\n${template}`
      : 'You are a professional cover letter writer. Write concise, genuine cover letters in under 150 words.';
    const prompt = `Write a cover letter for ${userName} applying to "${jobTitle}" at ${company}.
Their background: ${roles.slice(0, 3).join(', ')}.
Job description snippet: ${description.slice(0, 600)}
Return only the cover letter text, no subject line, no date.`;
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    });
    return result.response?.trim() ?? '';
  } catch {
    return '';
  }
}

function detectAtsType(url: string): string {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch { return 'unknown'; }
  if (/myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com/.test(hostname)) return 'workday';
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(hostname)) return 'greenhouse';
  if (/jobs\.lever\.co/.test(hostname)) return 'lever';
  if (/jobs\.ashbyhq\.com|boards\.ashbyhq\.com/.test(hostname)) return 'ashby';
  if (/\.taleo\.net/.test(hostname)) return 'taleo';
  if (/\.icims\.com/.test(hostname)) return 'icims';
  if (/\.linkedin\.com/.test(hostname)) return 'linkedin';
  if (/\.indeed\.com/.test(hostname)) return 'indeed';
  return 'unknown';
}

// ─── ATS question types ───────────────────────────────────────────────────────

export interface DraftQuestion {
  fieldKey: string;
  label: string;
  required: boolean;
  inputType: 'text' | 'select' | 'checkbox' | 'file' | 'textarea' | 'email' | 'tel';
  options?: string[];
  profileValue: string;
  isGeneral: boolean;
  isReadOnly: boolean;
  isGuessed?: boolean;
}

const GENERAL_FIELD_KEYS = new Set([
  'first_name', 'last_name', 'email', 'phone', 'linkedin_url',
  'website_url', 'github_url', 'visa_auth', 'cover_letter', 'resume',
  'location', 'location_city',
]);

async function fetchGreenhouseQuestions(applyUrl: string): Promise<Array<{
  name: string; label: string; required: boolean; type: string;
  values: Array<{ label: string; value: string }>;
}>> {
  try {
    let token: string | undefined;
    const tokenMatch = applyUrl.match(/[?&]token=(\d+)/i);
    if (tokenMatch) {
      token = tokenMatch[1];
    } else {
      const pathMatch = applyUrl.match(/greenhouse\.io\/(?:embed\/)?([^/]+)\/jobs\/(\d+)/i);
      if (pathMatch && pathMatch[1] !== 'job_app') token = pathMatch[2];
    }
    if (!token) return [];

    const embedRes = await fetch(`https://boards.greenhouse.io/embed/job_app?token=${token}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000),
    });
    if (!embedRes.ok) return [];
    const html = await embedRes.text();
    const actionMatch = html.match(/action="https:\/\/boards\.greenhouse\.io\/embed\/([^/]+)\/jobs\/(\d+)"/);
    if (!actionMatch) return [];
    const [, boardToken, jobId] = actionMatch;

    const apiRes = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?questions=true`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) },
    );
    if (!apiRes.ok) return [];
    const data = await apiRes.json() as { questions?: Array<{
      label: string; required: boolean; fields: Array<{ name: string; type: string; values: Array<{ label: string; value: string }> }>;
    }> };
    const questions: Array<{ name: string; label: string; required: boolean; type: string; values: Array<{ label: string; value: string }> }> = [];
    for (const q of data.questions ?? []) {
      for (const f of q.fields ?? []) {
        questions.push({ name: f.name, label: q.label, required: q.required, type: f.type, values: f.values ?? [] });
      }
    }
    return questions;
  } catch {
    return [];
  }
}

function buildDraftQuestions(
  atsType: string,
  rawQuestions: Array<{ name: string; label: string; required: boolean; type: string; values: Array<{ label: string; value: string }> }>,
  profileValues: Record<string, string>,
  overrides: Record<string, string>,
): DraftQuestion[] {
  if (atsType !== 'greenhouse' || rawQuestions.length === 0) {
    const pv = profileValues;
    const base: DraftQuestion[] = [
      { fieldKey: 'first_name',   label: 'First Name',       required: true,  inputType: 'text',     profileValue: pv['first_name'] ?? '',    isGeneral: true, isReadOnly: true },
      { fieldKey: 'last_name',    label: 'Last Name',        required: true,  inputType: 'text',     profileValue: pv['last_name'] ?? '',     isGeneral: true, isReadOnly: true },
      { fieldKey: 'email',        label: 'Email',            required: true,  inputType: 'email',    profileValue: pv['email'] ?? '',         isGeneral: true, isReadOnly: true },
      { fieldKey: 'phone',        label: 'Phone',            required: false, inputType: 'tel',      profileValue: pv['phone'] ?? '',         isGeneral: true, isReadOnly: !!pv['phone'] },
      { fieldKey: 'resume',       label: 'Resume/CV',        required: true,  inputType: 'file',     profileValue: 'Attached',                isGeneral: true, isReadOnly: true },
      { fieldKey: 'cover_letter', label: 'Cover Letter',     required: false, inputType: 'textarea', profileValue: 'Attached',                isGeneral: true, isReadOnly: true },
      { fieldKey: 'linkedin_url', label: 'LinkedIn Profile', required: false, inputType: 'text',     profileValue: pv['linkedin_url'] ?? '',  isGeneral: true, isReadOnly: !!pv['linkedin_url'] },
      { fieldKey: 'github_url',   label: 'GitHub Profile',   required: false, inputType: 'text',     profileValue: pv['github_url'] ?? '',    isGeneral: true, isReadOnly: !!pv['github_url'] },
      { fieldKey: 'website_url',  label: 'Website / Portfolio', required: false, inputType: 'text',  profileValue: pv['website_url'] ?? '',   isGeneral: true, isReadOnly: !!pv['website_url'] },
    ];
    return base;
  }

  const typeMap: Record<string, DraftQuestion['inputType']> = {
    input_text: 'text', input_file: 'file', textarea: 'textarea',
    multi_value_single_select: 'select', multi_value_multi_select: 'checkbox',
  };
  // Maps Greenhouse field names → our internal profileValues keys
  const fieldKeyMap: Record<string, string> = {
    first_name: 'first_name', last_name: 'last_name', email: 'email',
    phone: 'phone',
    resume: 'resume', resume_cv: 'resume', cv: 'resume', resume_upload: 'resume',
    cover_letter: 'cover_letter', cover_letter_text: 'cover_letter',
    linkedin_profile: 'linkedin_url', linkedin_url: 'linkedin_url', linkedin: 'linkedin_url',
    website: 'website_url', website_url: 'website_url', personal_website: 'website_url',
    github_url: 'github_url', github: 'github_url', github_profile: 'github_url',
  };

  // Detect combined legal name questions by label pattern
  function isLegalNameQuestion(label: string): boolean {
    const l = label.toLowerCase();
    return (l.includes('legal') && (l.includes('name') || l.includes('first') || l.includes('last'))) ||
           (l.includes('full name') && l.includes('legal'));
  }

  // Detect preferred name question
  function isPreferredNameQuestion(label: string): boolean {
    const l = label.toLowerCase();
    return l.includes('preferred name') || (l.includes('preferred') && l.includes('name'));
  }

  const seen = new Set<string>();
  return rawQuestions.flatMap((q): DraftQuestion[] => {
    const mappedKey = fieldKeyMap[q.name] ?? q.name;
    const isGeneral = GENERAL_FIELD_KEYS.has(mappedKey);
    const overrideVal = overrides[mappedKey] ?? overrides[q.name];
    const inputType = typeMap[q.type] ?? 'text';

    // Detect resume by label in case field name wasn't mapped
    const labelLower = q.label.toLowerCase();
    if (mappedKey === 'resume' || inputType === 'file' ||
        (labelLower.includes('resume') || labelLower === 'cv' || labelLower.includes('resume/cv'))) {
      if (seen.has('resume')) return [];
      seen.add('resume');
      return [{
        fieldKey: 'resume',
        label: q.label,
        required: q.required,
        inputType: 'file' as const,
        profileValue: 'Attached',
        isGeneral: true,
        isReadOnly: true,
      }];
    }

    // Cover letter is always auto-filled (shown separately via draft.coverLetter)
    if (mappedKey === 'cover_letter' ||
        labelLower.includes('cover letter') || labelLower.includes('cover_letter')) {
      if (seen.has('cover_letter')) return [];
      seen.add('cover_letter');
      return [{
        fieldKey: 'cover_letter',
        label: q.label,
        required: q.required,
        inputType: 'textarea' as const,
        profileValue: 'Attached',
        isGeneral: true,
        isReadOnly: true,
      }];
    }

    // Detect combined legal name field — pre-fill with full name
    let profileVal = profileValues[mappedKey] ?? '';
    if (!profileVal && isLegalNameQuestion(q.label)) {
      const fn = profileValues['first_name'] ?? '';
      const ln = profileValues['last_name'] ?? '';
      profileVal = [fn, ln].filter(Boolean).join(' ');
    }
    // Detect preferred name — pre-fill with first name as best guess
    if (!profileVal && isPreferredNameQuestion(q.label)) {
      profileVal = profileValues['first_name'] ?? '';
    }

    // Also detect linkedin/github/website by label when field name wasn't mapped
    if (!profileVal && !overrideVal) {
      const l = q.label.toLowerCase();
      if ((l.includes('linkedin') || l.includes('linked in')) && !profileVal) {
        profileVal = profileValues['linkedin_url'] ?? '';
      } else if ((l.includes('github') || l.includes('git hub')) && !profileVal) {
        profileVal = profileValues['github_url'] ?? '';
      } else if ((l.includes('website') || l.includes('portfolio') || l.includes('personal site')) && !profileVal) {
        profileVal = profileValues['website_url'] ?? '';
      } else if (l.includes('phone') || l.includes('mobile') || l.includes('telephone')) {
        profileVal = profileValues['phone'] ?? '';
      }
    }

    // Use override from autofillProfiles (saved from previous applications) first
    const value = overrideVal ?? profileVal;

    // Fuzzy-match a candidate string against a list of option labels.
    // Returns the best matching option label, or '' if nothing matches.
    function matchOption(candidate: string, opts: Array<{ label: string; value: string }>): string {
      if (!candidate || opts.length === 0) return '';
      const c = candidate.toLowerCase();
      // Exact match first
      const exact = opts.find((o) => o.label.toLowerCase() === c);
      if (exact) return exact.label;
      // Option label includes candidate
      const incl = opts.find((o) => o.label.toLowerCase().includes(c));
      if (incl) return incl.label;
      // Candidate includes option label
      const rev = opts.find((o) => c.includes(o.label.toLowerCase()));
      if (rev) return rev.label;
      // Word-level overlap — pick option with most shared words
      const candWords = new Set(c.split(/\W+/).filter(Boolean));
      let best = ''; let bestScore = 0;
      for (const o of opts) {
        const score = o.label.toLowerCase().split(/\W+/).filter((w) => candWords.has(w)).length;
        if (score > bestScore) { bestScore = score; best = o.label; }
      }
      return bestScore > 0 ? best : '';
    }

    // If still no value, try heuristic guessing from label keywords
    let guessedValue = '';
    if (!value) {
      const l = q.label.toLowerCase();
      const hasOpts = q.values.length > 0;

      // ── Work authorization / right to work ──
      if (l.includes('right to work') || l.includes('unrestricted right') ||
          l.includes('eligible to work') || l.includes('work authorization') ||
          l.includes('work auth') || l.includes('authorized to work') ||
          l.includes('legally authorized')) {
        const visaAuth = profileValues['visa_auth'] ?? '';
        // Non-sponsorship = "Yes" to right-to-work
        const needsSponsorship = visaAuth === 'needs_sponsorship';
        const raw = needsSponsorship ? 'No' : 'Yes';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || matchOption('Yes', q.values) || raw) : raw;

      // ── Sponsorship needed ──
      } else if (l.includes('require') && (l.includes('sponsor') || l.includes('visa')) ||
                 l.includes('need') && l.includes('sponsor') ||
                 l.includes('sponsorship')) {
        const visaAuth = profileValues['visa_auth'] ?? '';
        const needsSponsorship = visaAuth === 'needs_sponsorship';
        const raw = needsSponsorship ? 'Yes' : 'No';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || raw) : raw;

      // ── Privacy policy / consent / acknowledge ──
      } else if (l.includes('privacy policy') || l.includes('acknowledge') ||
                 l.includes('consent') || l.includes('agree') ||
                 l.includes('terms') || l.includes('confirm')) {
        // Find first "yes" / "agree" / "acknowledge" / "accept" option
        const yesOpt = q.values.find((o) => {
          const ol = o.label.toLowerCase();
          return ol.includes('yes') || ol.includes('agree') || ol.includes('acknowledge') ||
                 ol.includes('accept') || ol.includes('confirm') || ol.includes('i have');
        });
        guessedValue = yesOpt?.label ?? (hasOpts ? q.values[0]?.label ?? '' : 'Yes');

      // ── Start date / availability ──
      } else if (l.includes('start date') || l.includes('available') || l.includes('earliest start') ||
                 l.includes('when can you start') || l.includes('notice period')) {
        const stored = profileValues['earliest_start_date'] ?? profileValues['earliestStartDate'] ?? '';
        const raw = stored || 'Immediately';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || matchOption('Immediately', q.values) || raw) : raw;

      // ── Salary / compensation ──
      } else if (l.includes('salary') || l.includes('compensation') || l.includes('expected pay') ||
                 l.includes('pay expectation')) {
        guessedValue = profileValues['salary_min'] ?? '';

      // ── Pronouns ──
      } else if (l.includes('pronoun')) {
        const stored = profileValues['preferred_pronouns'] ?? profileValues['preferredPronouns'] ?? '';
        // Map stored value to common pronoun option labels
        const pronounMap: Record<string, string> = {
          man: 'He/Him', woman: 'She/Her', non_binary: 'They/Them', other: 'Prefer to self-describe',
        };
        const raw = pronounMap[stored] ?? stored ?? 'Prefer not to say';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || matchOption('Prefer not to say', q.values) || raw) : raw;

      // ── Gender identity ──
      } else if (l.includes('gender') && !l.includes('pronoun')) {
        const stored = profileValues['preferred_pronouns'] ?? '';
        const genderMap: Record<string, string> = {
          man: 'Man', woman: 'Woman', non_binary: 'Non-binary', other: 'Self-describe',
        };
        const raw = genderMap[stored] ?? 'Prefer not to say';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || matchOption('Prefer not to say', q.values) || raw) : raw;

      // ── Race / ethnicity ──
      } else if (l.includes('race') || l.includes('ethnicity')) {
        const stored = profileValues['ethnicity'] ?? '';
        const ethnicMap: Record<string, string> = {
          asian: 'Asian', black: 'Black or African American', hispanic: 'Hispanic or Latino',
          white: 'White', middle_eastern: 'Middle Eastern', native_american: 'American Indian',
          pacific_islander: 'Native Hawaiian', two_or_more: 'Two or more races',
        };
        const raw = ethnicMap[stored] ?? 'Decline to state';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || matchOption('Decline', q.values) || matchOption('Prefer not', q.values) || raw) : raw;

      // ── Veteran status ──
      } else if (l.includes('veteran')) {
        const stored = profileValues['veteran_status'] ?? profileValues['veteranStatus'] ?? '';
        const raw = stored === 'veteran' ? 'I identify as a protected veteran' : 'I am not a protected veteran';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || matchOption('not a protected', q.values) || raw) : raw;

      // ── Disability status ──
      } else if (l.includes('disability') || l.includes('disabled')) {
        const stored = profileValues['disability_status'] ?? profileValues['disabilityStatus'] ?? '';
        const raw = stored === 'yes' ? 'Yes, I have a disability' : 'No, I don\'t have a disability';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || matchOption('No', q.values) || raw) : raw;

      // ── Willing to relocate ──
      } else if (l.includes('relocate') || l.includes('relocation')) {
        const willing = profileValues['willing_to_relocate'] ?? profileValues['willingToRelocate'] ?? 'false';
        const raw = (willing === 'true' || willing === '1') ? 'Yes' : 'No';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || raw) : raw;

      // ── How did you hear / referral source ──
      } else if (l.includes('how did you hear') || l.includes('referral') || l.includes('source') ||
                 l.includes('how did you find')) {
        guessedValue = hasOpts ? (matchOption('LinkedIn', q.values) || matchOption('Online', q.values) || '') : 'LinkedIn';

      // ── Citizenship ──
      } else if (l.includes('citizenship') || l.includes('citizen')) {
        const visaAuth = profileValues['visa_auth'] ?? '';
        const raw = (visaAuth === 'citizen' || visaAuth === 'permanent_resident') ? 'Yes' : 'No';
        guessedValue = hasOpts ? (matchOption(raw, q.values) || raw) : raw;

      // ── Country ──
      } else if (l.includes('country') && !l.includes('citizenship')) {
        guessedValue = profileValues['location'] ?? 'Canada';
        if (hasOpts) guessedValue = matchOption(guessedValue, q.values) || matchOption('Canada', q.values) || guessedValue;

      // ── City / location ──
      } else if (l.includes('city') || l.includes('current location') || l.includes('where are you based')) {
        guessedValue = profileValues['location_city'] ?? profileValues['location'] ?? '';

      // ── Years of experience ──
      } else if ((l.includes('years') || l.includes('experience')) && hasOpts) {
        const yoe = Number(profileValues['years_of_experience'] ?? profileValues['yearsOfExperience'] ?? 0);
        if (yoe > 0) {
          const numericOpt = q.values.find((o) => {
            const nums = o.label.match(/\d+/g)?.map(Number) ?? [];
            if (nums.length === 0) return false;
            if (nums.length === 1) return Math.abs(nums[0]! - yoe) <= 1;
            return yoe >= nums[0]! && yoe <= nums[nums.length - 1]!;
          });
          guessedValue = numericOpt?.label ?? q.values[Math.floor(q.values.length / 2)]?.label ?? '';
        } else {
          guessedValue = q.values[Math.floor(q.values.length / 2)]?.label ?? '';
        }

      // ── Worked here / employed by company before ──
      } else if (hasOpts && (
        (l.includes('worked') || l.includes('employed') || l.includes('work for') || l.includes('work at')) &&
        (l.includes('before') || l.includes('previously') || l.includes('ever') || l.includes('past'))
      )) {
        guessedValue = (matchOption('No', q.values) || matchOption('no', q.values) || q.values[0]?.label) ?? '';

      // ── Used / tried the company product ──
      } else if (hasOpts && (l.includes('used') || l.includes('tried') || l.includes('use') || l.includes('familiar with')) &&
                 !l.includes('authorization') && !l.includes('auth')) {
        // "Have you used X?" — yes is safe, shows brand affinity
        guessedValue = (matchOption('Yes', q.values) || q.values[0]?.label) ?? '';

      // ── Conflict of interest / outside business / relationships ──
      } else if (hasOpts && (
        l.includes('conflict') || l.includes('outside business') || l.includes('familial') ||
        l.includes('personal relationship') || l.includes('intellectual property') ||
        l.includes('investment') || l.includes('outside activit')
      )) {
        guessedValue = (matchOption('No', q.values) || q.values[0]?.label) ?? '';

      // ── Degree type ──
      } else if (hasOpts && (l.includes('degree') || l.includes('type of degree') || l.includes('pursuing'))) {
        // Pull from education entries if available
        const edu = profileValues['education_degree'] ?? '';
        const degreeMap: Record<string, string> = {
          bachelor: "Bachelor's", bachelors: "Bachelor's", bs: "Bachelor's", ba: "Bachelor's",
          master: "Master's", masters: "Master's", ms: "Master's", ma: "Master's",
          phd: 'PhD', doctorate: 'PhD', doctor: 'PhD',
          associate: "Associate's", diploma: 'Diploma',
        };
        const raw = Object.entries(degreeMap).reduce<string>((found, [key, label]) =>
          found || (edu.toLowerCase().includes(key) ? label : ''), '') || "Bachelor's";
        guessedValue = (matchOption(raw, q.values) || matchOption("Bachelor's", q.values) || q.values[0]?.label) ?? '';

      // ── Graduation date ──
      } else if (hasOpts && (l.includes('graduation') || l.includes('graduate') || l.includes('grad date') ||
                 l.includes('expected graduation') || l.includes('completion date'))) {
        const gradYear = profileValues['education_end_year'] ?? profileValues['graduation_year'] ?? '';
        if (gradYear) {
          guessedValue = (matchOption(gradYear, q.values) || q.values[0]?.label) ?? '';
        } else {
          // Default to first option (usually current/upcoming year)
          guessedValue = q.values[0]?.label ?? '';
        }

      // ── Catchall: any unmatched select with Yes/No options — pick "No" as safe default ──
      } else if (hasOpts && inputType === 'select') {
        const noOpt = q.values.find((o) => o.label.toLowerCase() === 'no');
        const yesOpt = q.values.find((o) => o.label.toLowerCase() === 'yes');
        // Only auto-guess if it's purely a yes/no question (2-3 options, one is Yes, one is No)
        const isPureYesNo = q.values.length <= 3 && noOpt && yesOpt;
        if (isPureYesNo) {
          // For required questions that ask "do you have X" or "are you X" — default No (safer)
          guessedValue = noOpt.label;
        }
      }
    }

    // For select fields: ensure guessedValue is an actual option label (exact match required for <select>)
    if (guessedValue && q.values.length > 0 && inputType === 'select') {
      const matched = matchOption(guessedValue, q.values);
      guessedValue = matched; // blank if no match — better than wrong selection
    }

    const finalValue = value || guessedValue;
    const isGuessed = !value && !!guessedValue;

    // General fields with a known profile/override value are ALWAYS read-only.
    // Guessed values stay editable so the user can verify/change them.
    const isReadOnly = isGeneral && !!value;

    if (seen.has(mappedKey)) return [];
    seen.add(mappedKey);
    return [{
      fieldKey: mappedKey,
      label: q.label,
      required: q.required,
      inputType,
      ...(q.values.length > 0 ? { options: q.values.map((v) => v.label) } : {}),
      profileValue: finalValue,
      isGeneral,
      isReadOnly,
      isGuessed,
    }];
  });
}

// ─── Quick Apply ──────────────────────────────────────────────────────────────

jobs.post('/:id/quick-apply', zValidator('json', QuickApplySchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const user = c.get('user');
  const { id: jobId } = c.req.param();
  const body = c.req.valid('json');

  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
  if (!job) return c.json({ error: 'Job not found' }, 404);

  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  // Tier 1 check
  if (isTier1Company(job.company) && !profile?.tier1QuickApply) {
    return c.json({ error: 'Quick Apply for Tier 1 companies is disabled. Enable it in Settings → Quick Apply.' }, 403);
  }

  const atsType = detectAtsType(job.applyUrl);
  const atsProfile = await db.query.autofillProfiles.findFirst({
    where: and(eq(schema.autofillProfiles.userId, userId), eq(schema.autofillProfiles.atsType, atsType)),
  });
  const atsEnabled = atsProfile?.enabled ?? profile?.quickApplyAll ?? true;
  if (!atsEnabled) {
    return c.json({ error: `Quick Apply is disabled for ${atsType}. Enable it in Autofill Profiles.` }, 403);
  }

  // Find default resume version
  let resumeVersionId = body.resumeVersionId;
  if (!resumeVersionId) {
    const defaultResume = await db.query.resumes.findFirst({
      where: and(eq(schema.resumes.userId, userId), eq(schema.resumes.isDefault, true)),
      with: { versions: { orderBy: [desc(schema.resumeVersions.createdAt)], limit: 1 } },
    });
    resumeVersionId = defaultResume?.versions[0]?.id;
  }
  if (!resumeVersionId) return c.json({ error: 'No resume found. Upload a resume in Settings first.' }, 400);

  const resumeVersion = await db.query.resumeVersions.findFirst({
    where: eq(schema.resumeVersions.id, resumeVersionId),
  });

  const overrides = (atsProfile?.fieldOverrides ?? {}) as Record<string, string>;
  const clTemplate = overrides['cover_letter_template'];

  // Generate cover letter
  const coverLetter = await generateCoverLetter(
    c.env, job.title, job.company, job.descriptionPlain ?? '',
    profile?.displayName ?? user.name ?? user.email,
    (profile?.roles ?? []) as string[], clTemplate,
  );

  const nameParts = (profile?.displayName ?? user.name ?? user.email).trim().split(' ');
  // Pull the most recent education entry for degree/graduation guesses
  const eduEntries = (profile?.education ?? []) as Array<{ degree?: string; institution?: string; endYear?: string }>;
  const latestEdu = eduEntries[eduEntries.length - 1];
  const profileValues: Record<string, string> = {
    first_name: nameParts[0] ?? '',
    last_name: nameParts.slice(1).join(' '),
    email: profile?.applyEmail ?? user.email,
    phone: profile?.phone ?? '',
    location: ((profile?.locations ?? []) as string[])[0] ?? '',
    location_city: ((profile?.locations ?? []) as string[])[0] ?? '',
    linkedin_url: profile?.linkedinUrl ?? '',
    github_url: profile?.githubUrl ?? '',
    website_url: profile?.websiteUrl ?? '',
    visa_auth: profile?.visaAuth ?? '',
    cover_letter: coverLetter,
    years_of_experience: String(profile?.yearsOfExperience ?? ''),
    preferred_pronouns: profile?.preferredPronouns ?? '',
    ethnicity: profile?.ethnicity ?? '',
    veteran_status: profile?.veteranStatus ?? '',
    disability_status: profile?.disabilityStatus ?? '',
    earliest_start_date: profile?.earliestStartDate ?? '',
    willing_to_relocate: profile?.willingToRelocate ? 'true' : 'false',
    education_degree: latestEdu?.degree ?? '',
    education_end_year: latestEdu?.endYear ?? '',
  };

  // Fetch ATS-specific questions (parallel with draft creation)
  const rawQuestions = atsType === 'greenhouse'
    ? await fetchGreenhouseQuestions(job.applyUrl)
    : [];

  const questions = buildDraftQuestions(atsType, rawQuestions, profileValues, overrides);

  // Create draft with status needs_review
  const [draft] = await db
    .insert(schema.applicationDrafts)
    .values({
      userId,
      jobId,
      resumeVersionId,
      coverLetter,
      qaBundle: { questions, atsType, applyUrl: job.applyUrl },
      status: 'needs_review',
      requiresApproval: false,
      applyMethod: atsType === 'ashby' || atsType === 'greenhouse' || atsType === 'lever' ? 'ats_api' : 'autofill_queue',
      expiresAt: draftExpiresAt(),
    })
    .returning();

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'quick_apply_draft',
    metadata: { jobId, draftId: draft!.id, atsType },
  });

  return c.json({
    status: 'needs_review',
    draftId: draft!.id,
    questions,
    resumeVersionLabel: resumeVersion?.versionLabel ?? 'v1',
    atsType,
  }, 201);
});

// ─── Matches ──────────────────────────────────────────────────────────────────

const matches = new Hono<{ Bindings: Env; Variables: Variables }>();

matches.get('/', zValidator('query', MatchesQuerySchema), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { page, limit, minScore } = c.req.valid('query');
  const offset = (page - 1) * limit;

  const conditions = [
    eq(schema.jobMatches.userId, userId),
    eq(schema.jobMatches.dismissed, false),
  ];
  if (minScore !== undefined) conditions.push(gte(schema.jobMatches.score, minScore));

  const rows = await db.query.jobMatches.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.jobMatches.score), desc(schema.jobMatches.createdAt)],
    with: { job: true },
    limit,
    offset,
  });

  return c.json({ matches: rows, page, limit });
});

matches.post('/:id/dismiss', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const match = await db.query.jobMatches.findFirst({
    where: and(eq(schema.jobMatches.id, id), eq(schema.jobMatches.userId, userId)),
  });
  if (!match) return c.json({ error: 'Not found' }, 404);

  await db
    .update(schema.jobMatches)
    .set({ dismissed: true })
    .where(eq(schema.jobMatches.id, id));

  return c.json({ ok: true });
});

export { jobs, matches };
