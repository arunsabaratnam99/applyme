export interface Job {
  id: string;
  company: string;
  title: string;
  location: string;
  country: string;
  workplaceType: string | null;
  jobCategory: string;
  employmentType: string;
  applyUrl: string;
  jobUrl: string;
  postedAt: string | null;
  sourceType: string;
  sourceRepo: string | null;
  descriptionPlain: string;
  salaryMin: string | null;
  salaryMax: string | null;
}

export interface JobsResponse {
  jobs: Job[];
  page: number;
  limit: number;
}

export interface SalaryData {
  min: number | null;
  max: number | null;
  median: number | null;
  currency: string;
  source: 'linkedin' | 'job_posting' | null;
}

export const SOURCE_META: Record<string, { label: string; color: string }> = {
  linkedin:          { label: 'LinkedIn',          color: 'text-[#0A66C2]' },
  linkedin_scraper:  { label: 'LinkedIn',          color: 'text-[#0A66C2]' },
  indeed:            { label: 'Indeed',            color: 'text-[#2164F3]' },
  indeed_scraper:    { label: 'Indeed',            color: 'text-[#2164F3]' },
  github_repo:       { label: 'GitHub Jobs',       color: 'text-foreground' },
  greenhouse:        { label: 'Greenhouse',        color: 'text-[#3AB060]' },
  lever:             { label: 'Lever',             color: 'text-[#3B49DF]' },
  ashby:             { label: 'Ashby',             color: 'text-[#6B50E8]' },
  workday:           { label: 'Workday',           color: 'text-[#DC5C36]' },
  jobbank_ca:        { label: 'Job Bank CA',       color: 'text-[#B5121B]' },
  remotive:          { label: 'Remotive',          color: 'text-[#00B894]' },
  workatastartup:    { label: 'Work at a Startup', color: 'text-[#FF6B35]' },
};

export const EMPLOYMENT_TYPES = [
  { id: 'full_time',  label: 'Full-time' },
  { id: 'internship', label: 'Internship' },
  { id: 'co_op',      label: 'Co-op' },
  { id: 'contract',   label: 'Contract' },
  { id: 'part_time',  label: 'Part-time' },
] as const;

export const JOB_CATEGORIES = [
  { id: 'software',  label: 'Software' },
  { id: 'business',  label: 'Business' },
  { id: 'data',      label: 'Data / ML' },
  { id: 'design',    label: 'Design' },
  { id: 'product',   label: 'Product' },
  { id: 'devops',    label: 'DevOps' },
  { id: 'security',  label: 'Security' },
  { id: 'qa',        label: 'QA' },
] as const;

export const WORKPLACE_TYPES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
] as const;
