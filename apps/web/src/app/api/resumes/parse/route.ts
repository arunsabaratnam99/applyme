import { type NextRequest, NextResponse } from 'next/server';
import { extractText, extractLinks, getDocumentProxy } from 'unpdf';

// ─── Lookup tables ──────────────────────────────────────────────────────────

const COMMON_ROLES = [
  'software engineer', 'senior software engineer', 'staff software engineer',
  'principal software engineer', 'lead software engineer',
  'frontend developer', 'front-end developer', 'frontend engineer',
  'backend developer', 'back-end developer', 'backend engineer',
  'full stack developer', 'full-stack developer', 'full stack engineer',
  'mobile developer', 'ios developer', 'android developer',
  'data engineer', 'data scientist', 'data analyst',
  'machine learning engineer', 'ml engineer', 'ai engineer',
  'devops engineer', 'site reliability engineer', 'sre',
  'cloud engineer', 'platform engineer', 'infrastructure engineer',
  'product manager', 'technical product manager', 'product owner',
  'ux designer', 'ui designer', 'ui/ux designer',
  'qa engineer', 'quality assurance engineer', 'test engineer',
  'security engineer', 'solutions architect', 'software architect',
  'web developer', 'web engineer', 'javascript developer',
  'react developer', 'node.js developer', 'python developer',
  'java developer', '.net developer', 'golang developer',
  'intern', 'software developer intern', 'engineering intern',
  'co-op', 'coop student', 'software co-op',
];

const TECH_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'go', 'golang', 'rust', 'c++', 'c#', 'scala', 'swift', 'dart',
  'react', 'next.js', 'vue', 'angular', 'svelte', 'node.js', 'express', 'fastapi', 'spring boot', 'spring',
  'django', 'flask', 'rails', 'laravel', 'pyspark', 'pandas', 'numpy', 'pytest', 'flutter',
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'mssql', 'bigquery', 'supabase',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'firebase', 'mlflow', 'microsoft fabric',
  'graphql', 'rest', 'grpc', 'kafka', 'rabbitmq', 'ci/cd', 'github actions', 'jenkins',
  'machine learning', 'deep learning', 'nlp', 'pytorch', 'tensorflow', 'fasttext',
  'figma', 'tailwind', 'css', 'html', 'sql', 'git', 'jira', 'postman', 'linux',
  'alembic', 'sqlalchemy', 'oauth', 'google cloud', 'cloudflare', 'drizzle',
];

const CANADIAN_PROVINCES: Record<string, string> = {
  'ontario': 'ON', 'on': 'ON',
  'british columbia': 'BC', 'bc': 'BC',
  'alberta': 'AB', 'ab': 'AB',
  'quebec': 'QC', 'qc': 'QC',
  'manitoba': 'MB', 'mb': 'MB',
  'saskatchewan': 'SK', 'sk': 'SK',
  'nova scotia': 'NS', 'ns': 'NS',
  'new brunswick': 'NB', 'nb': 'NB',
};

const CITIES = [
  'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton',
  'winnipeg', 'hamilton', 'kitchener', 'waterloo', 'london', 'brampton',
  'mississauga', 'markham', 'richmond hill', 'north york', 'scarborough',
  'new york', 'san francisco', 'seattle', 'austin', 'boston', 'chicago',
  'los angeles', 'denver', 'atlanta', 'miami', 'dallas',
];

const SECTION_HEADERS: Record<string, string[]> = {
  summary: ['summary', 'profile', 'about me', 'about', 'objective', 'professional summary', 'career objective', 'overview'],
  experience: ['experience', 'work experience', 'employment', 'work history', 'professional experience', 'career history'],
  education: ['education', 'academic background', 'academic history', 'qualifications', 'degrees'],
  skills: ['skills', 'technical skills', 'technologies', 'competencies', 'tools', 'tech stack'],
  projects: ['projects', 'personal projects', 'side projects', 'open source'],
  activities: ['activities', 'volunteer', 'volunteering', 'extracurricular', 'awards', 'certifications', 'publications'],
};

const DEGREE_KEYWORDS = [
  'bachelor', 'b.sc', 'bsc', 'b.s.', 'b.eng', 'b.a.', 'ba ', 'b.a ', 'be ',
  'master', 'm.sc', 'msc', 'm.s.', 'm.eng', 'm.a.', 'mba',
  'phd', 'ph.d', 'doctorate', 'doctor',
  'diploma', 'certificate', 'associate',
  'honours', 'honors',
];

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// ─── Text extraction ─────────────────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

function extractTextFromDocx(buffer: Buffer): string {
  // Unzip the DOCX (it's a ZIP) and pull text from word/document.xml
  const zip = buffer.toString('binary');
  // Find word/document.xml content between its boundaries in the raw binary
  const startMarker = 'word/document.xml';
  const startIdx = zip.indexOf(startMarker);
  if (startIdx === -1) {
    // Fallback: extract all w:t tags from the entire buffer
    const xmlMatch = zip.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    return xmlMatch.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
  }
  // Get a chunk after the marker that contains the XML content
  const chunk = zip.slice(startIdx, startIdx + 500000);
  const xmlMatch = chunk.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
  const text = xmlMatch.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
  return text || (zip.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)?.map((m) => m.replace(/<[^>]+>/g, '')).join(' ') ?? '');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// All known section header words used to re-split merged single-line PDFs
const ALL_SECTION_WORDS = [
  'Technical Skills', 'Skills', 'Experience', 'Work Experience', 'Education',
  'Projects', 'Personal Projects', 'Activities', 'Certifications', 'Awards',
  'Summary', 'Profile', 'Objective', 'Volunteer', 'Publications',
];

/**
 * Split raw text into cleaned lines.
 * Handles two cases:
 * 1. Normal multi-line text — split on newlines as usual.
 * 2. Single-line merged PDF text (unpdf mergePages:true) — re-insert newlines
 *    before section headers, date ranges, and bullet characters.
 */
function toLines(text: string): string[] {
  // If text has real newlines, use them directly
  const naturalLines = text.split(/\n|\r\n|\r/).map((l) => l.trim()).filter(Boolean);
  if (naturalLines.length > 3) return naturalLines;

  // Single-line mode: re-split the merged text
  let s = text;

  // 1. Insert newline before each known section header (word-boundary match)
  for (const header of ALL_SECTION_WORDS) {
    // Escape for regex
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`(?<=[\\w,.)]) (${escaped})(?=[ :\n])`, 'gi'), '\n$1');
  }

  // 2. Insert newline before date ranges like "Jan 2026 - Present", "May 2025 - Sep 2025"
  s = s.replace(
    /(?<=[a-z.,)] )((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{4}\s*[-–—])/gi,
    '\n$1'
  );

  // 3. Insert newline before bullet characters
  s = s.replace(/(?<=\S) ([•▪◦])/g, '\n$1');

  // 4. Insert newline before "Expected Month Year" (education date)
  s = s.replace(/(?<=[a-z) ]) (Expected\s+[A-Z][a-z]+\s+\d{4})/gi, '\n$1');

  return s.split(/\n|\r\n|\r/).map((l) => l.trim()).filter(Boolean);
}

/** Return the index of the first line that matches a set of section header keywords */
function findSectionStart(lines: string[], headers: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;
    const l = raw.toLowerCase().replace(/[:\-–—•*]/g, '').trim();
    if (headers.some((h) => l === h || l.startsWith(h + ' ') || l.endsWith(' ' + h))) return i;
  }
  return -1;
}

/** Collect lines from sectionStart+1 until the next recognizable section header */
function extractSection(lines: string[], startIdx: number): string[] {
  const allHeaders = Object.values(SECTION_HEADERS).flat();
  const result: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === undefined) continue;
    const l = raw.toLowerCase().replace(/[:\-–—•*]/g, '').trim();
    if (allHeaders.some((h) => l === h || l.startsWith(h + ' '))) break;
    result.push(raw);
  }
  return result;
}

// ─── Field extractors ────────────────────────────────────────────────────────

function inferName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 10)) {
    const clean = line.trim();
    if (!clean) continue;

    // Handle merged single-line: name is text before first | or # or email-like token
    // e.g. "Arun Sabaratnam \x80 Website | # asaba059@..."
    const beforePipe = clean.split(/[|#@\x80\x81\x82]|mailto:/)[0]?.trim() ?? '';
    const candidate = beforePipe.replace(/[^A-Za-z '\-]/g, '').trim();
    if (candidate.length >= 3 && candidate.length <= 60) {
      const words = candidate.split(/\s+/);
      if (words.length >= 2 && words.length <= 5 &&
          words.every((w) => /^[A-Z][a-z'-]+$/.test(w) || /^[A-Z]{2,4}$/.test(w))) {
        return candidate;
      }
    }

    // Standard check: short title-case line with no special chars
    if (clean.length > 60) continue;
    if (/[<>@\d#$%&*|]/.test(clean)) continue;
    const words = clean.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    if (words.every((w) => /^[A-Z][a-z'-]+$/.test(w) || /^[A-Z]{2,4}$/.test(w))) {
      return clean;
    }
  }
  return undefined;
}

function inferEmail(text: string): string | undefined {
  const m = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]{2,}/);
  return m?.[0];
}

function inferPhone(text: string): string | undefined {
  const patterns = [
    /\+?1?\s*[\(\-]?\d{3}[\)\-\s]\s*\d{3}[\-\s]\d{4}/,
    /\+\d{1,3}[\s\-]\d{1,4}[\s\-]\d{3,4}[\s\-]\d{4}/,
    /\(\d{3}\)\s*\d{3}[\-\s]\d{4}/,
    /\d{3}[\-.\s]\d{3}[\-.\s]\d{4}/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[0]) {
      const digits = m[0].replace(/\D/g, '');
      if (digits.length >= 10) return m[0].trim();
    }
  }
  return undefined;
}

function inferLinkedIn(text: string): string | undefined {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-%.]+\/?/i);
  if (!m) return undefined;
  const url = m[0];
  return url.startsWith('http') ? url : `https://${url}`;
}

function inferGitHub(text: string): string | undefined {
  const m = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-%.]+\/?/i);
  if (!m) return undefined;
  const url = m[0];
  return url.startsWith('http') ? url : `https://${url}`;
}

function inferWebsite(text: string, linkedIn?: string, gitHub?: string): string | undefined {
  const m = text.match(/https?:\/\/(?!(?:www\.)?linkedin\.com)(?!(?:www\.)?github\.com)[\w\-./~%?=&+#]+/i);
  if (!m) return undefined;
  const url = m[0].replace(/[,;)\s]+$/, '');
  if (linkedIn && url.includes('linkedin.com')) return undefined;
  if (gitHub && url.includes('github.com')) return undefined;
  return url;
}

function inferHeadline(lines: string[], nameIdx: number): string | undefined {
  for (let i = nameIdx + 1; i < Math.min(nameIdx + 5, lines.length); i++) {
    const line = (lines[i] ?? '').trim();
    if (!line) continue;
    if (line.match(/[@\d(]/)) continue;
    if (line.length < 5 || line.length > 120) continue;
    const lower = line.toLowerCase();
    if (COMMON_ROLES.some((r) => lower.includes(r))) return line;
    if (lower.includes('engineer') || lower.includes('developer') || lower.includes('designer') ||
        lower.includes('manager') || lower.includes('analyst') || lower.includes('scientist')) {
      return line;
    }
  }
  return undefined;
}

function inferSummary(lines: string[]): string | undefined {
  const idx = findSectionStart(lines, SECTION_HEADERS.summary ?? []);
  if (idx === -1) return undefined;
  const section = extractSection(lines, idx);
  const paras = section.filter((l) => l.trim().length > 30);
  if (!paras.length) return undefined;
  return paras.slice(0, 4).join(' ').trim().slice(0, 800);
}

function inferRoles(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const role of COMMON_ROLES) {
    if (lower.includes(role)) {
      found.push(titleCase(role));
    }
  }
  return [...new Set(found)].slice(0, 6);
}

function inferKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const kw of TECH_KEYWORDS) {
    if (lower.includes(kw)) found.push(kw);
  }
  return [...new Set(found)].slice(0, 20);
}

function inferLocations(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const city of CITIES) {
    if (lower.includes(city)) {
      const titleCity = titleCase(city);
      for (const [prov, code] of Object.entries(CANADIAN_PROVINCES)) {
        if (lower.includes(city + ', ' + prov) || lower.includes(city + ' ' + prov)) {
          found.push(`${titleCity}, ${code}`);
          break;
        }
      }
      if (!found.find((f) => f.toLowerCase().startsWith(city))) {
        found.push(titleCity);
      }
    }
  }
  return [...new Set(found)].slice(0, 3);
}

interface WorkEntry {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
}

/** Parse a date string like "Jan 2020", "2020", "Present", "Current" → { month, year } */
function parseDate(s: string): { month: number; year: number } | null {
  const clean = s.trim().toLowerCase();
  if (!clean || clean === 'present' || clean === 'current' || clean === 'now') {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }
  // "Jan 2020" / "January 2020"
  const monthYear = clean.match(/^([a-z]+)[\s,]+(\d{4})$/);
  if (monthYear) {
    const monthKey = monthYear[1] ?? '';
    const yearStr = monthYear[2] ?? '0';
    const month = MONTH_MAP[monthKey] ?? 1;
    return { month, year: parseInt(yearStr) };
  }
  // "2020"
  const yearOnly = clean.match(/^(\d{4})$/);
  if (yearOnly) return { month: 1, year: parseInt(yearOnly[1] ?? '0') };
  return null;
}

/** Extract date range from a line like "Jan 2019 – Mar 2021", "2018 - Present", or "Expected May 2026" */
function extractDateRange(line: string): { startDate: string; endDate: string } | null {
  const dateRangeRe = /([A-Za-z]*\s*\d{4})\s*[-–—to]+\s*([A-Za-z]*\s*\d{4}|present|current|now)/i;
  const m = line.match(dateRangeRe);
  if (m && m[1] && m[2]) {
    return { startDate: m[1].trim(), endDate: m[2].trim() };
  }
  return null;
}

/** Extract a single year or "Month Year" from a line (e.g. "Expected May 2026", "May 2026") */
function extractSingleDate(line: string): string | null {
  const m = line.match(/(?:expected\s+)?([A-Za-z]+\s+\d{4}|\d{4})/i);
  return m?.[1]?.trim() ?? null;
}

/** True if line contains a date range OR a standalone date */
function hasAnyDate(line: string): boolean {
  return extractDateRange(line) !== null || /\b(20\d{2}|19\d{2})\b/.test(line);
}

/** Compute total months across all work entries for yearsOfExperience */
function computeYearsOfExperience(entries: WorkEntry[]): number {
  let totalMonths = 0;
  for (const e of entries) {
    const start = parseDate(e.startDate);
    const end = parseDate(e.endDate);
    if (!start || !end) continue;
    const months = (end.year - start.year) * 12 + (end.month - start.month);
    if (months > 0) totalMonths += months;
  }
  return Math.round((totalMonths / 12) * 10) / 10;
}

/** Strip city/location suffixes like ", Toronto, ON" or "Toronto, ON" from end of string */
function stripLocation(s: string): string {
  return s.replace(/,?\s+[A-Z][a-z]+(?:,\s*[A-Z]{2})?\s*$/, '').trim();
}

/** True if a line looks like a job title (contains common role words) */
function looksLikeTitle(s: string): boolean {
  const l = s.toLowerCase();
  return l.includes('engineer') || l.includes('developer') || l.includes('manager') ||
    l.includes('analyst') || l.includes('designer') || l.includes('architect') ||
    l.includes('intern') || l.includes('co-op') || l.includes('coop') ||
    l.includes('lead') || l.includes('director') || l.includes('officer') ||
    l.includes('associate') || l.includes('specialist') || l.includes('consultant') ||
    l.includes('researcher') || l.includes('scientist') || l.includes('coordinator');
}

function inferWorkExperience(lines: string[]): WorkEntry[] {
  const idx = findSectionStart(lines, SECTION_HEADERS.experience ?? []);
  if (idx === -1) return [];

  const section = extractSection(lines, idx).filter((l) => l.trim().length > 0);
  const entries: WorkEntry[] = [];

  // ── Pass 1: find "entry boundary" lines ──────────────────────────────────
  // A boundary is any non-bullet line that contains a date range.
  // We split the section into groups, each group starting at a boundary.
  const DATE_RE = /([A-Za-z]*\s*\d{4})\s*[-–—]+\s*([A-Za-z]*\s*\d{4}|present|current|now)/i;
  const isBullet = (s: string) => /^[•\-–*▪◦]/.test(s.trim());

  // Collect indices of boundary lines (contain a date range and are not bullets)
  const boundaryIdxs: number[] = [];
  for (let i = 0; i < section.length; i++) {
    const l = section[i]!.trim();
    if (!isBullet(l) && DATE_RE.test(l)) boundaryIdxs.push(i);
  }

  // If no date-range lines found, fall back to finding groups by role-word headers
  if (boundaryIdxs.length === 0) {
    let current: Partial<WorkEntry> | null = null;
    const descLines: string[] = [];
    function flushFallback() {
      if (current?.company || current?.title) {
        entries.push({
          company: current.company ?? '',
          title: current.title ?? '',
          startDate: current.startDate ?? '',
          endDate: current.endDate ?? '',
          description: descLines.join(' ').trim().slice(0, 500),
        });
      }
    }
    for (const line of section) {
      const clean = line.trim();
      const bullet = isBullet(clean);
      if (!bullet && looksLikeTitle(clean)) {
        flushFallback();
        descLines.length = 0;
        current = { title: clean.split(' | ')[0]?.trim() ?? clean };
      } else if (bullet && current) {
        descLines.push(clean.replace(/^[•\-–*▪◦]\s*/, ''));
      } else if (current && !current.company && !bullet) {
        current.company = clean;
      }
    }
    flushFallback();
    return entries.slice(0, 10);
  }

  // ── Pass 2: for each boundary group, extract company/title ────────────────
  for (let g = 0; g < boundaryIdxs.length; g++) {
    const start = boundaryIdxs[g]!;
    const end = g + 1 < boundaryIdxs.length ? boundaryIdxs[g + 1]! : section.length;
    const group = section.slice(start, end);

    let company = '';
    let title = '';
    let startDate = '';
    let endDate = '';
    const descLines: string[] = [];

    for (let i = 0; i < group.length; i++) {
      const clean = (group[i] ?? '').trim();
      if (!clean) continue;
      const bullet = isBullet(clean);

      if (bullet) {
        descLines.push(clean.replace(/^[•\-–*▪◦]\s*/, ''));
        continue;
      }

      const drMatch = clean.match(DATE_RE);
      if (drMatch) {
        // Extract dates
        startDate = drMatch[1]?.trim() ?? '';
        endDate = drMatch[2]?.trim() ?? '';
        // Strip the date portion from the line to get remaining text
        const withoutDate = clean.replace(DATE_RE, '').trim().replace(/[|,–\-]+$/, '').trim();
        // Also strip location like "Toronto, ON"
        const text = stripLocation(withoutDate);

        if (!text) continue; // pure date line, context on adjacent lines

        // Determine if remaining text is a title or company
        // Check for pipe separator: "Company | Title" or "Title | Stack"
        if (text.includes(' | ')) {
          const parts = text.split(' | ').map((p) => p.trim()).filter(Boolean);
          // First part with role word = title; other = company
          const titlePart = parts.find((p) => looksLikeTitle(p));
          const companyPart = parts.find((p) => p !== titlePart);
          title = titlePart ?? parts[0] ?? '';
          company = companyPart ?? '';
        } else if (looksLikeTitle(text)) {
          // "Software Engineer at Google" or just "Software Engineer Intern"
          const atMatch = text.match(/^(.+?)\s+at\s+(.+)$/i);
          if (atMatch) {
            title = atMatch[1]?.trim() ?? '';
            company = atMatch[2]?.trim() ?? '';
          } else {
            title = text;
          }
        } else {
          // Text before date is the company name
          company = text;
        }
        continue;
      }

      // Non-bullet, non-date line within this group
      // If it's the first non-date line and we're missing either company or title
      if (!title && looksLikeTitle(clean)) {
        // It's a title line (e.g. "Software Engineer Intern | Python, Spring Boot")
        title = clean.split(' | ')[0]?.trim() ?? clean;
      } else if (!company && !looksLikeTitle(clean) && clean.length < 80) {
        // Short non-role line is likely a company name
        company = stripLocation(clean);
      } else if (title && company) {
        // We have both — must be description
        descLines.push(clean);
      }
    }

    // If we still only have one of title/company, check previous group's last header lines
    // (handles case where company is on line before the boundary)
    if (!company && start > 0) {
      for (let k = start - 1; k >= Math.max(0, start - 3); k--) {
        const prev = (section[k] ?? '').trim();
        if (!prev || isBullet(prev) || DATE_RE.test(prev)) break;
        if (!looksLikeTitle(prev) && prev.length < 80) {
          company = stripLocation(prev);
          break;
        }
      }
    }

    if (title || company) {
      entries.push({
        company,
        title,
        startDate,
        endDate,
        description: descLines.join(' ').trim().slice(0, 950),
      });
    }
  }

  return entries.slice(0, 10);
}

/** Extract degree name and field of study from a degree line */
function parseDegreeText(text: string): { degree: string; field: string } {
  const degreeMatch = text.match(/(?:bachelor|master|phd|ph\.d|doctorate|doctor|diploma|certificate|mba|b\.sc|m\.sc|b\.eng|b\.a|m\.eng|m\.a|honours?|honor)[^,\n]*/i);
  if (!degreeMatch) return { degree: text.trim(), field: '' };
  const full = degreeMatch[0].trim();
  const inIdx = full.toLowerCase().indexOf(' in ');
  if (inIdx !== -1) {
    return {
      degree: full.slice(0, inIdx).trim(),
      field: full.slice(inIdx + 4).trim().replace(/[,;].*$/, '').trim(),
    };
  }
  return { degree: full, field: '' };
}

function inferEducation(lines: string[]): EducationEntry[] {
  const idx = findSectionStart(lines, SECTION_HEADERS.education ?? []);
  if (idx === -1) return [];

  const section = extractSection(lines, idx).filter((l) => l.trim().length > 0);
  const entries: EducationEntry[] = [];

  const YEAR_RE = /\b(20\d{2}|19\d{2})\b/;
  const DATE_RANGE_RE = /([A-Za-z]*\s*\d{4})\s*[-–—]+\s*([A-Za-z]*\s*\d{4}|present|current|now)/i;
  const SINGLE_DATE_RE = /(?:expected\s+)?([A-Za-z]+\s+\d{4}|\d{4})/i;

  function getYears(text: string): { startYear: string; endYear: string } {
    const dr = text.match(DATE_RANGE_RE);
    if (dr) {
      return {
        startYear: (dr[1]?.match(/\d{4}/)?.[0]) ?? '',
        endYear: (dr[2]?.match(/\d{4}/)?.[0]) ?? '',
      };
    }
    const years = [...text.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map((m) => m[1] ?? '');
    if (years.length >= 2) return { startYear: years[0] ?? '', endYear: years[years.length - 1] ?? '' };
    if (years.length === 1) return { startYear: '', endYear: years[0] ?? '' };
    // "Expected May 2026" single-date format
    const sd = text.match(SINGLE_DATE_RE);
    if (sd) return { startYear: '', endYear: sd[1]?.match(/\d{4}/)?.[0] ?? '' };
    return { startYear: '', endYear: '' };
  }

  // Group lines into entry blocks — a new block starts when we see
  // a degree keyword OR a line that has a year AND no degree keyword in current entry yet
  let current: Partial<EducationEntry> | null = null;

  function flush() {
    if (current?.institution || current?.degree) {
      entries.push({
        institution: current.institution ?? '',
        degree: current.degree ?? '',
        field: current.field ?? '',
        startYear: current.startYear ?? '',
        endYear: current.endYear ?? '',
      });
    }
  }

  for (const line of section) {
    const clean = line.trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    const hasDegree = DEGREE_KEYWORDS.some((d) => lower.includes(d));
    const hasYear = YEAR_RE.test(clean);

    if (hasDegree) {
      // Does this line also have an institution? e.g. "University of Toronto — Bachelor of Science"
      // Check for known institution patterns OR if line before was an institution
      if (current?.institution && !current.degree) {
        // Institution already set — this is the degree line
        const { degree, field } = parseDegreeText(clean);
        current.degree = degree;
        current.field = field;
        // Pick up dates if on this line
        if (!current.endYear) {
          const y = getYears(clean);
          current.startYear = y.startYear;
          current.endYear = y.endYear;
        }
      } else {
        // Start a new entry
        flush();
        current = {};
        const { degree, field } = parseDegreeText(clean);
        current.degree = degree;
        current.field = field;
        const y = getYears(clean);
        current.startYear = y.startYear;
        current.endYear = y.endYear;
      }
    } else if (!current) {
      // First line of a new entry — must be institution name
      current = { institution: stripLocation(clean).replace(/\s*(expected|\d{4}).*$/i, '').trim() };
      if (hasYear) {
        const y = getYears(clean);
        current.startYear = y.startYear;
        current.endYear = y.endYear;
      }
    } else if (!current.institution && !hasDegree) {
      // Institution line after degree was set first (less common)
      current.institution = stripLocation(clean).replace(/\s*(expected|\d{4}).*$/i, '').trim();
      if (hasYear && !current.endYear) {
        const y = getYears(clean);
        current.startYear = y.startYear;
        current.endYear = y.endYear;
      }
    } else if (hasYear && !current.endYear) {
      // Date-only line (e.g. "Expected May 2026    Ottawa, ON")
      const y = getYears(clean);
      current.startYear = y.startYear || current.startYear || '';
      current.endYear = y.endYear;
    }
    // Other lines (location-only, GPA, etc.) are ignored
  }

  flush();
  return entries.slice(0, 5);
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let text = '';
    let pdfLinks: string[] = [];
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const [{ text: extractedText }, { links }] = await Promise.all([
        extractText(pdf, { mergePages: true }),
        extractLinks(pdf).catch(() => ({ links: [] as string[], totalPages: 0 })),
      ]);
      text = extractedText;
      pdfLinks = links;
    } else {
      text = extractTextFromDocx(buffer);
    }

    const lines = toLines(text);

    const displayName    = inferName(lines);
    const nameParts      = displayName ? displayName.trim().split(/\s+/) : [];
    const firstName      = nameParts[0] ?? undefined;
    const lastName       = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
    const nameIdx        = displayName ? lines.findIndex((l) => l.trim() === displayName) : 0;
    const email          = inferEmail(text);
    const phone          = inferPhone(text);

    // Prefer text-extracted URLs; fall back to embedded PDF hyperlinks
    const allLinkText = text + '\n' + pdfLinks.join('\n');
    const linkedinUrl    = inferLinkedIn(allLinkText)
      ?? pdfLinks.find((l) => l.toLowerCase().includes('linkedin.com'));
    const githubUrl      = inferGitHub(allLinkText)
      ?? pdfLinks.find((l) => l.toLowerCase().includes('github.com'));
    const websiteUrl     = inferWebsite(allLinkText, linkedinUrl, githubUrl)
      ?? pdfLinks.find((l) => !l.toLowerCase().includes('linkedin.com') && !l.toLowerCase().includes('github.com') && l.startsWith('http'));
    const headline       = inferHeadline(lines, nameIdx >= 0 ? nameIdx : 0);
    const summary        = inferSummary(lines);
    const roles          = inferRoles(text);

    // Try LLM extraction first; fall back to static list on failure
    let keywords: string[] = inferKeywords(text);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_BASE_URL ?? 'http://localhost:3000';
      const kwRes = await fetch(`${baseUrl}/api/keywords/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 6000) }),
      });
      if (kwRes.ok) {
        const kwData = (await kwRes.json()) as { keywords?: string[] };
        if (kwData.keywords?.length) keywords = kwData.keywords;
      }
    } catch {
      // fallback already set
    }

    const locations      = inferLocations(text);
    const location       = locations[0] ?? undefined;
    const workExperience = inferWorkExperience(lines);
    const education      = inferEducation(lines);
    const yearsOfExperience = workExperience.length > 0 ? Math.round(computeYearsOfExperience(workExperience)) : undefined;

    console.log('\n========== RESUME PARSE DEBUG ==========');
    console.log('[text] first 800 chars:\n', text.slice(0, 800));
    console.log('[lines] first 30 lines:\n', lines.slice(0, 30));
    console.log('[pdfLinks]', pdfLinks);
    console.log('[name]', { displayName, firstName, lastName });
    console.log('[contact]', { email, phone });
    console.log('[links]', { linkedinUrl, githubUrl, websiteUrl });
    console.log('[location]', { locations, location });
    console.log('[roles]', roles);
    console.log('[keywords]', keywords?.slice(0, 10));
    console.log('[workExperience]', JSON.stringify(workExperience, null, 2));
    console.log('[education]', JSON.stringify(education, null, 2));
    console.log('[yearsOfExperience]', yearsOfExperience);
    console.log('=========================================\n');

    return NextResponse.json({
      displayName,
      firstName,
      lastName,
      email,
      phone,
      linkedinUrl,
      githubUrl,
      websiteUrl,
      headline,
      summary,
      roles,
      keywords,
      locations,
      location,
      workExperience,
      education,
      yearsOfExperience,
    });
  } catch (err) {
    console.error('[parse-resume]', err);
    return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 });
  }
}
