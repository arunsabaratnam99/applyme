import type { NotificationPrefs } from './types/index.js';

// Fields that must never appear in logs
export const PII_FIELDS = [
  'email',
  'phone',
  'address',
  'visaAuth',
  'visa_auth',
  'salaryMin',
  'salary_min',
  'salaryMax',
  'salary_max',
  'coverLetter',
  'cover_letter',
  'resumeContent',
] as const;

export type PiiField = (typeof PII_FIELDS)[number];

/**
 * Strips PII fields from an object before logging.
 */
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if ((PII_FIELDS as readonly string[]).includes(key)) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Canadian provinces and territories — used for location validation.
 */
export const CA_PROVINCES: Record<string, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

const CA_PROVINCE_TERMS = Object.entries(CA_PROVINCES).flatMap(([code, name]) => [
  code.toLowerCase(),
  name.toLowerCase(),
]);

const CA_REMOTE_TERMS = ['canada', 'ca-remote', 'remote canada', 'anywhere in canada', 'canada wide'];

/**
 * Returns true if the location string resolves to a Canadian location.
 */
export function isCanadianLocation(location: string): boolean {
  const lower = location.toLowerCase().trim();

  if (lower === '' || CA_REMOTE_TERMS.some((t) => lower.includes(t))) return true;
  if (CA_PROVINCE_TERMS.some((t) => lower.includes(t))) return true;

  const CA_CITIES = [
    'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton',
    'winnipeg', 'hamilton', 'kitchener', 'waterloo', 'london', 'victoria',
    'halifax', 'saskatoon', 'regina', 'burnaby', 'surrey', 'brampton',
    'mississauga', 'richmond hill', 'markham', 'oakville', 'barrie',
    'oshawa', 'guelph', 'kelowna', 'abbotsford', 'coquitlam', 'laval',
    'gatineau', 'longueuil', 'sherbrooke', 'fredericton', 'moncton',
    'charlottetown', 'yellowknife', 'whitehorse', 'st. john',
  ];

  return CA_CITIES.some((city) => lower.includes(city));
}

/**
 * Returns 'CA-remote' if the job is remote with no specific province,
 * otherwise returns the original location string (trimmed).
 */
export function normalizeLocation(location: string): string {
  const lower = location.toLowerCase().trim();
  if (
    lower === '' ||
    lower === 'remote' ||
    lower === 'canada' ||
    CA_REMOTE_TERMS.some((t) => lower === t)
  ) {
    return 'CA-remote';
  }
  return location.trim();
}

/**
 * Returns true if the current time is within the user's configured quiet hours.
 * quietStart and quietEnd are "HH:MM" strings in the user's local time.
 */
export function isInQuietHours(prefs: NotificationPrefs, nowHour: number, nowMinute: number): boolean {
  if (!prefs.quietStart || !prefs.quietEnd) return false;

  const [startH, startM] = prefs.quietStart.split(':').map(Number) as [number, number];
  const [endH, endM] = prefs.quietEnd.split(':').map(Number) as [number, number];

  const nowTotal = nowHour * 60 + nowMinute;
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  // Handle overnight ranges (e.g. 22:00 – 08:00)
  if (startTotal > endTotal) {
    return nowTotal >= startTotal || nowTotal <= endTotal;
  }
  return nowTotal >= startTotal && nowTotal <= endTotal;
}

/**
 * Generates a draft expiry date (30 days from now).
 */
export function draftExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

/**
 * Generates an autofill queue item expiry date (72 hours from now).
 */
export function queueExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 72);
  return d;
}

/**
 * Generates an application record expiry date (1 year from now).
 */
export function applicationExpiresAt(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/**
 * Formats a relative time string (e.g. "2 days ago", "just now").
 */
export function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
