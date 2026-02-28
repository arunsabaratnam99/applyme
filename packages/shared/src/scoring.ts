import type { Job, UserProfile, WatchlistItem, MatchReason } from './types/index.js';
import { canonicalizeCompanyName } from './canonicalize.js';

export interface ScoringInput {
  job: Job;
  profile: UserProfile;
  watchlistItems: WatchlistItem[];
}

export interface ScoringResult {
  score: number;
  reasons: MatchReason[];
  passed: boolean;
}

const WEIGHTS = {
  keywordTitle: 15,
  keywordDescription: 5,
  watchlistCompany: 20,
  watchlistRole: 15,
  watchlistKeyword: 10,
  locationExact: 20,
  locationProvince: 10,
  remoteMatch: 15,
  recencyBonus: 10,
  employmentTypeMatch: 10,
  categoryMatch: 5,
} as const;

const CANADIAN_PROVINCES: Record<string, string[]> = {
  ON: ['ontario', 'toronto', 'ottawa', 'mississauga', 'brampton', 'hamilton', 'london', 'kitchener', 'waterloo'],
  BC: ['british columbia', 'vancouver', 'victoria', 'burnaby', 'surrey', 'kelowna', 'abbotsford'],
  AB: ['alberta', 'calgary', 'edmonton', 'red deer', 'lethbridge'],
  QC: ['quebec', 'montreal', 'laval', 'gatineau', 'longueuil', 'sherbrooke', 'saguenay'],
  MB: ['manitoba', 'winnipeg', 'brandon'],
  SK: ['saskatchewan', 'saskatoon', 'regina'],
  NS: ['nova scotia', 'halifax', 'dartmouth'],
  NB: ['new brunswick', 'moncton', 'fredericton', 'saint john'],
  NL: ['newfoundland', 'labrador', 'st. john'],
  PE: ['prince edward island', 'charlottetown'],
  NT: ['northwest territories', 'yellowknife'],
  YT: ['yukon', 'whitehorse'],
  NU: ['nunavut', 'iqaluit'],
};

/**
 * Determines which province a location string maps to.
 * Returns null if no match.
 */
function getProvinceCode(location: string): string | null {
  const lower = location.toLowerCase();
  for (const [code, terms] of Object.entries(CANADIAN_PROVINCES)) {
    if (lower.includes(code.toLowerCase()) || terms.some((t) => lower.includes(t))) {
      return code;
    }
  }
  return null;
}

/**
 * Returns days since postedAt. Returns null if no date.
 */
function daysSincePosted(postedAt: Date | null): number | null {
  if (!postedAt) return null;
  const ms = Date.now() - postedAt.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Hard filters — returns false if the job should be excluded entirely.
 */
export function passesHardFilters(job: Job, profile: UserProfile): boolean {
  // Must be Canada
  if (job.country !== 'CA') return false;

  // Category must match user preferences
  if (profile.jobCategories.length > 0 && !profile.jobCategories.includes(job.jobCategory)) {
    return false;
  }

  // Employment type must match if user has a preference
  if (profile.employmentTypes.length > 0 && !profile.employmentTypes.includes(job.employmentType)) {
    return false;
  }

  // Exclude keywords — check title + description
  const text = `${job.title} ${job.descriptionPlain}`.toLowerCase();
  for (const excluded of profile.excludeKeywords) {
    if (text.includes(excluded.toLowerCase())) return false;
  }

  // Work authorization — simple text match against description
  if (profile.visaAuth) {
    const authLower = profile.visaAuth.toLowerCase();
    const descLower = job.descriptionPlain.toLowerCase();
    // Only hard-block if description explicitly requires citizenship/clearance and user doesn't have it
    const requiresCitizenship =
      descLower.includes('canadian citizen only') ||
      descLower.includes('must be a canadian citizen') ||
      descLower.includes('requires security clearance');
    if (requiresCitizenship && !authLower.includes('citizen')) {
      return false;
    }
  }

  return true;
}

/**
 * Main scoring function. Returns a score 0–100 and reasons array.
 */
export function scoreJob(input: ScoringInput): ScoringResult {
  const { job, profile, watchlistItems } = input;

  if (!passesHardFilters(job, profile)) {
    return { score: 0, reasons: [], passed: false };
  }

  let score = 0;
  const reasons: MatchReason[] = [];

  const titleLower = job.title.toLowerCase();
  const descLower = job.descriptionPlain.toLowerCase().slice(0, 2000);
  const jobCompany = canonicalizeCompanyName(job.company);

  // ─── Keyword matching ────────────────────────────────────────────────────
  for (const keyword of profile.keywords) {
    const kw = keyword.toLowerCase();
    if (titleLower.includes(kw)) {
      score += WEIGHTS.keywordTitle;
      reasons.push({ type: 'keyword_match', label: `"${keyword}" in title`, score: WEIGHTS.keywordTitle });
      break;
    } else if (descLower.includes(kw)) {
      score += WEIGHTS.keywordDescription;
      reasons.push({ type: 'keyword_match', label: `"${keyword}" in description`, score: WEIGHTS.keywordDescription });
      break;
    }
  }

  // ─── Watchlist matching ───────────────────────────────────────────────────
  const companyWatchItems = watchlistItems.filter((w) => w.itemType === 'company');
  const roleWatchItems = watchlistItems.filter((w) => w.itemType === 'role');
  const keywordWatchItems = watchlistItems.filter((w) => w.itemType === 'keyword');

  for (const item of companyWatchItems) {
    if (jobCompany.includes(canonicalizeCompanyName(item.value))) {
      score += WEIGHTS.watchlistCompany;
      reasons.push({ type: 'watchlist_company', label: `Watching ${item.value}`, score: WEIGHTS.watchlistCompany });
      break;
    }
  }

  for (const item of roleWatchItems) {
    if (titleLower.includes(item.value.toLowerCase())) {
      score += WEIGHTS.watchlistRole;
      reasons.push({ type: 'watchlist_role', label: `Role match: ${item.value}`, score: WEIGHTS.watchlistRole });
      break;
    }
  }

  for (const item of keywordWatchItems) {
    const kw = item.value.toLowerCase();
    if (titleLower.includes(kw) || descLower.includes(kw)) {
      score += WEIGHTS.watchlistKeyword;
      reasons.push({ type: 'keyword_match', label: `Watching keyword: ${item.value}`, score: WEIGHTS.watchlistKeyword });
      break;
    }
  }

  // ─── Location matching ────────────────────────────────────────────────────
  const jobLocationLower = job.location.toLowerCase();
  const isRemote = job.workplaceType === 'remote' || jobLocationLower.includes('remote');

  if (isRemote && profile.preferredRemote) {
    score += WEIGHTS.remoteMatch;
    reasons.push({ type: 'remote_match', label: 'Remote role', score: WEIGHTS.remoteMatch });
  } else if (profile.locations.length > 0) {
    const jobProvince = getProvinceCode(job.location);
    for (const prefLocation of profile.locations) {
      const prefLower = prefLocation.toLowerCase();
      if (jobLocationLower.includes(prefLower) || prefLower.includes(jobLocationLower)) {
        score += WEIGHTS.locationExact;
        reasons.push({ type: 'location_match', label: `Location: ${job.location}`, score: WEIGHTS.locationExact });
        break;
      }
      const prefProvince = getProvinceCode(prefLocation);
      if (jobProvince && prefProvince && jobProvince === prefProvince) {
        score += WEIGHTS.locationProvince;
        reasons.push({ type: 'location_match', label: `Province: ${jobProvince}`, score: WEIGHTS.locationProvince });
        break;
      }
    }
  }

  // ─── Recency bonus ────────────────────────────────────────────────────────
  const age = daysSincePosted(job.postedAt);
  if (age !== null) {
    if (age <= 3) {
      score += WEIGHTS.recencyBonus;
      reasons.push({ type: 'recency', label: 'Posted today or recently', score: WEIGHTS.recencyBonus });
    } else if (age <= 7) {
      score += Math.round(WEIGHTS.recencyBonus * 0.7);
      reasons.push({ type: 'recency', label: 'Posted this week', score: Math.round(WEIGHTS.recencyBonus * 0.7) });
    } else if (age <= 14) {
      score += Math.round(WEIGHTS.recencyBonus * 0.4);
      reasons.push({ type: 'recency', label: 'Posted within 2 weeks', score: Math.round(WEIGHTS.recencyBonus * 0.4) });
    }
  }

  // ─── Employment type match ────────────────────────────────────────────────
  if (profile.employmentTypes.includes(job.employmentType)) {
    score += WEIGHTS.employmentTypeMatch;
    reasons.push({ type: 'employment_type_match', label: `${job.employmentType.replace('_', ' ')}`, score: WEIGHTS.employmentTypeMatch });
  }

  // ─── Category match ───────────────────────────────────────────────────────
  if (profile.jobCategories.includes(job.jobCategory)) {
    score += WEIGHTS.categoryMatch;
    reasons.push({ type: 'category_match', label: job.jobCategory, score: WEIGHTS.categoryMatch });
  }

  // Cap at 100
  const finalScore = Math.min(100, score);
  return { score: finalScore, reasons, passed: finalScore > 0 };
}
