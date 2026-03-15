import type { JobCategory, EmploymentType } from './types/index.js';

// ─── Software role keywords ───────────────────────────────────────────────────

const SOFTWARE_TITLE_KEYWORDS = [
  'software', 'developer', 'engineer', 'engineering', 'programmer',
  'frontend', 'front-end', 'backend', 'back-end', 'full stack', 'fullstack',
  'devops', 'sre', 'site reliability', 'platform', 'infrastructure',
  'data', 'ml', 'machine learning', 'ai ', 'artificial intelligence',
  'analytics', 'data scientist', 'data analyst', 'data engineer',
  'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker',
  'mobile', 'ios', 'android', 'react', 'angular', 'vue',
  'qa', 'quality assurance', 'test', 'automation',
  'security', 'cybersecurity', 'infosec', 'devsecops',
  'architect', 'technical lead', 'tech lead',
  'product manager', 'product management', 'scrum master',
  'database', 'dba', 'etl', 'bi ', 'business intelligence',
  'network', 'systems', 'embedded', 'firmware', 'hardware',
  'it ', 'information technology', 'helpdesk', 'support engineer',
  'ui', 'ux', 'user experience', 'user interface', 'design engineer',
];

// ─── Business role keywords ───────────────────────────────────────────────────

const BUSINESS_TITLE_KEYWORDS = [
  'analyst', 'business analyst', 'financial analyst', 'strategy',
  'manager', 'management', 'director', 'vice president', 'vp ',
  'finance', 'accounting', 'accountant', 'controller', 'cfo',
  'marketing', 'growth', 'brand', 'digital marketing', 'seo', 'sem',
  'sales', 'account executive', 'account manager', 'business development',
  'operations', 'ops', 'supply chain', 'logistics', 'procurement',
  'hr ', 'human resources', 'recruiter', 'talent', 'people ops',
  'project manager', 'program manager', 'pmo',
  'consultant', 'consulting', 'advisory',
  'communications', 'public relations', 'pr ',
  'legal', 'compliance', 'risk', 'audit',
  'customer success', 'customer support', 'client services',
  'investor relations', 'corporate development',
  'product analyst', 'revenue', 'pricing',
];

// ─── Internship / co-op keywords ─────────────────────────────────────────────

// Unambiguous internship/co-op signals — explicit terms only, no role-level words
const INTERNSHIP_TITLE_KEYWORDS = [
  'intern', 'internship',
  'student', 'practicum', 'trainee',
  'placement', 'work term',
];

// Entry-level signals — only used when NO senior signal is present
const NEW_GRAD_TITLE_KEYWORDS = [
  'new grad', 'new graduate', 'junior', 'entry level', 'entry-level',
  'early career',
];

// Senior signals — any of these blocks new-grad / ambiguous internship detection
const SENIOR_SIGNALS = [
  'senior', 'sr.', 'sr ', 'lead', 'principal', 'staff', 'director',
  'manager', 'head of', 'vp ', 'vice president',
];

const CO_OP_KEYWORDS = ['co-op', 'coop', 'co op', 'cooperative education'];

// ─── Classifiers ──────────────────────────────────────────────────────────────

/**
 * Classifies a job as 'software' or 'business' based on title + description.
 * Returns null if neither category matches (job should be dropped for MVP).
 */
export function classifyJobCategory(
  title: string,
  description: string,
): JobCategory | null {
  const text = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  const softwareScore = SOFTWARE_TITLE_KEYWORDS.filter((kw) =>
    titleLower.includes(kw),
  ).length;

  const businessScore = BUSINESS_TITLE_KEYWORDS.filter((kw) =>
    titleLower.includes(kw),
  ).length;

  if (softwareScore === 0 && businessScore === 0) {
    // Fall back to description scan with lower weight
    const descSoftware = SOFTWARE_TITLE_KEYWORDS.filter((kw) => text.includes(kw)).length;
    const descBusiness = BUSINESS_TITLE_KEYWORDS.filter((kw) => text.includes(kw)).length;
    if (descSoftware === 0 && descBusiness === 0) return null;
    return descSoftware >= descBusiness ? 'software' : 'business';
  }

  return softwareScore >= businessScore ? 'software' : 'business';
}

/**
 * Classifies employment type from job title.
 * Senior signals are checked first — if present the role is always full_time.
 * Then co-op, then explicit internship keywords, then junior/new-grad signals.
 */
export function classifyEmploymentType(title: string): EmploymentType {
  const lower = title.toLowerCase();

  // Senior signals always win — no senior role should be classified as intern
  if (SENIOR_SIGNALS.some((kw) => lower.includes(kw))) {
    return 'full_time';
  }

  if (CO_OP_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'co_op';
  }

  if (INTERNSHIP_TITLE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'internship';
  }

  // New-grad / junior signals → full_time (they are entry-level employees, not interns)
  if (NEW_GRAD_TITLE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'full_time';
  }

  return 'full_time';
}

/**
 * Returns true if the given text contains any internship/co-op indicator.
 */
export function isInternshipOrCoOp(title: string): boolean {
  const type = classifyEmploymentType(title);
  return type === 'internship' || type === 'co_op';
}

/**
 * Classifies workplace type from a location/description string.
 */
export function classifyWorkplace(
  text: string,
): 'remote' | 'hybrid' | 'onsite' | null {
  const lower = text.toLowerCase();
  if (!lower) return null;

  const remoteKws = ['remote', 'work from home', 'wfh', 'fully distributed', 'anywhere'];
  const hybridKws = ['hybrid'];
  const onsiteKws = ['on-site', 'onsite', 'in-office', 'in office', 'on site'];

  if (remoteKws.some((kw) => lower.includes(kw))) return 'remote';
  if (hybridKws.some((kw) => lower.includes(kw))) return 'hybrid';
  if (onsiteKws.some((kw) => lower.includes(kw))) return 'onsite';
  return null;
}

export { SOFTWARE_TITLE_KEYWORDS, BUSINESS_TITLE_KEYWORDS, INTERNSHIP_TITLE_KEYWORDS };
