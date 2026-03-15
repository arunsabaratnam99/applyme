'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  MapPin, Building2, Clock, ExternalLink, Zap, Radio,
  Search, X, ChevronLeft, ChevronRight, DollarSign,
  FileText, Briefcase, ChevronDown, SlidersHorizontal,
  Lock, Check, Star, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
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
  descriptionPlain: string;
  salaryMin: string | null;
  salaryMax: string | null;
}

interface JobsResponse {
  jobs: Job[];
  page: number;
  limit: number;
}

interface UserProfile {
  employmentTypes: string[] | null;
  jobCategories: string[] | null;
  locations: string[] | null;
  dealBreakerFields: { employmentTypes: boolean; jobCategories: boolean; workplaceType: boolean } | null;
}

interface SalaryData {
  min: number | null;
  max: number | null;
  median: number | null;
  currency: string;
  source: 'linkedin' | 'job_posting' | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; color: string }> = {
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

const EMPLOYMENT_TYPES = [
  { id: 'full_time',  label: 'Full-time' },
  { id: 'internship', label: 'Internship' },
  { id: 'co_op',      label: 'Co-op' },
  { id: 'contract',   label: 'Contract' },
  { id: 'part_time',  label: 'Part-time' },
] as const;

const JOB_CATEGORIES = [
  { id: 'software',  label: 'Software' },
  { id: 'business',  label: 'Business' },
  { id: 'data',      label: 'Data / ML' },
  { id: 'design',    label: 'Design' },
  { id: 'product',   label: 'Product' },
  { id: 'devops',    label: 'DevOps' },
  { id: 'security',  label: 'Security' },
  { id: 'qa',        label: 'QA' },
] as const;

const WORKPLACE_TYPES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
] as const;

// ─── Company logo helper ──────────────────────────────────────────────────────

function companyToDomain(company: string): string {
  const overrides: Record<string, string> = {
    'shopify': 'shopify.com', 'amazon': 'amazon.com', 'google': 'google.com',
    'microsoft': 'microsoft.com', 'apple': 'apple.com', 'meta': 'meta.com',
    'netflix': 'netflix.com', 'stripe': 'stripe.com', 'airbnb': 'airbnb.com',
    'uber': 'uber.com', 'lyft': 'lyft.com', 'twitter': 'twitter.com',
    'x': 'x.com', 'slack': 'slack.com', 'salesforce': 'salesforce.com',
    'oracle': 'oracle.com', 'ibm': 'ibm.com', 'intel': 'intel.com',
    'nvidia': 'nvidia.com', 'td': 'td.com', 'rbc': 'rbc.com',
    'bmo': 'bmo.com', 'scotiabank': 'scotiabank.com', 'cibc': 'cibc.com',
    'rogers': 'rogers.com', 'bell': 'bell.ca', 'telus': 'telus.com',
    'shopify inc': 'shopify.com', 'capital one': 'capitalone.com',
    'bank of canada': 'bankofcanada.ca', 'cgi': 'cgi.com',
    'deloitte': 'deloitte.com', 'kpmg': 'kpmg.com', 'pwc': 'pwc.com',
    'accenture': 'accenture.com', 'sap': 'sap.com', 'adobe': 'adobe.com',
    'atlassian': 'atlassian.com', 'github': 'github.com', 'gitlab': 'gitlab.com',
  };
  const key = company.toLowerCase().trim();
  if (overrides[key]) return overrides[key];
  // Generic: company name → domain guess
  return key.replace(/[^a-z0-9]/g, '') + '.com';
}

function CompanyLogo({ company, size = 40 }: { company: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const domain = companyToDomain(company);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
      >
        {company.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden border border-border/40"
    >
      <img
        src={`/api/logo?domain=${encodeURIComponent(domain)}`}
        alt={company}
        width={size}
        height={size}
        className="object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ─── Date filter options ──────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { id: 'any',   label: 'Any time' },
  { id: '24h',   label: 'Past 24 hours' },
  { id: 'week',  label: 'Past week' },
  { id: 'month', label: 'Past month' },
] as const;

type DateFilter = 'any' | '24h' | 'week' | 'month';

function isWithinDate(postedAt: string | null, filter: DateFilter): boolean {
  if (filter === 'any' || !postedAt) return true;
  const now = Date.now();
  const posted = new Date(postedAt).getTime();
  const diff = now - posted;
  if (filter === '24h')   return diff < 24 * 60 * 60 * 1000;
  if (filter === 'week')  return diff < 7  * 24 * 60 * 60 * 1000;
  if (filter === 'month') return diff < 30 * 24 * 60 * 60 * 1000;
  return true;
}

// ─── Location matching ────────────────────────────────────────────────────────

const ABBREV_MAP: Record<string, string> = {
  'ON': 'Ontario', 'BC': 'British Columbia', 'AB': 'Alberta', 'QC': 'Quebec',
  'MB': 'Manitoba', 'SK': 'Saskatchewan', 'NS': 'Nova Scotia', 'NB': 'New Brunswick',
  'NL': 'Newfoundland', 'PE': 'Prince Edward Island', 'YT': 'Yukon', 'NT': 'Northwest Territories', 'NU': 'Nunavut',
  'CA': 'California', 'NY': 'New York', 'TX': 'Texas', 'WA': 'Washington',
  'MA': 'Massachusetts', 'IL': 'Illinois', 'GA': 'Georgia', 'FL': 'Florida',
  'CO': 'Colorado', 'VA': 'Virginia', 'NC': 'North Carolina', 'OR': 'Oregon',
  'AZ': 'Arizona', 'MN': 'Minnesota', 'MI': 'Michigan', 'OH': 'Ohio',
  'PA': 'Pennsylvania', 'NJ': 'New Jersey', 'MD': 'Maryland', 'CT': 'Connecticut',
  'UT': 'Utah', 'TN': 'Tennessee', 'MO': 'Missouri', 'IN': 'Indiana',
};

function expandAbbrevs(text: string): string {
  return text.replace(/\b([A-Z]{2})\b/g, (match) => ABBREV_MAP[match] ?? match);
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'canada': 'CA',
  'united states': 'US',
  'usa': 'US',
  'us': 'US',
  'remote': 'CA',
};

function locationMatches(stored: string, filter: string, country?: string): boolean {
  const s = stored.toLowerCase();
  const f = filter.toLowerCase();
  // Check if filter is a country name — match against the country code field
  const countryCode = COUNTRY_NAME_TO_CODE[f];
  if (countryCode && country) {
    if (country.toUpperCase() === countryCode) return true;
  }
  // Direct substring match
  if (s.includes(f)) return true;
  // Expand abbreviations in filter and retry (e.g. "Toronto, ON" → "Toronto, Ontario")
  const expanded = expandAbbrevs(filter).toLowerCase();
  if (s.includes(expanded)) return true;
  // Token-based: every comma-separated token in the filter must appear in stored
  const tokens = f.split(',').map((t) => t.trim()).filter(Boolean);
  return tokens.every((t) => {
    const expandedT = expandAbbrevs(t).toLowerCase();
    return s.includes(t) || s.includes(expandedT);
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface WatchlistData {
  items: Array<{ itemType: string; value: string }>;
}

export default function JobsPage() {
  const { data: profile } = useSWR<UserProfile | null>('/api/profile', (url: string) => api.get<UserProfile | null>(url));
  const { data: watchlistData } = useSWR<WatchlistData>('/api/watchlist', (url: string) => api.get<WatchlistData>(url));

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [selectedEmployment, setSelectedEmployment] = React.useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string[]>([]);
  const [selectedWorkplace, setSelectedWorkplace] = React.useState<string[]>([]);
  const [dateFilter, setDateFilter] = React.useState<DateFilter>('any');
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [profileDefaultsApplied, setProfileDefaultsApplied] = React.useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = React.useState(false);
  // Extended filters (in More Filters panel — applied immediately)
  const [salaryMin, setSalaryMin] = React.useState('');
  const [salaryMax, setSalaryMax] = React.useState('');
  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = React.useState<string[]>([]);
  const [prioritizeWatchlist, setPrioritizeWatchlist] = React.useState(false);

  // Apply profile defaults once loaded
  React.useEffect(() => {
    if (!profile || profileDefaultsApplied) return;
    setProfileDefaultsApplied(true);
    if (profile.employmentTypes?.length) setSelectedEmployment(profile.employmentTypes);
    if (profile.jobCategories?.length) setSelectedCategory(profile.jobCategories);
  }, [profile, profileDefaultsApplied]);

  // Stable SWR key — must be memoized so the key string doesn't change on every render
  // (a new URLSearchParams() on every render produces a new key → infinite refetch loop)
  const swrKey = React.useMemo(() => {
    const p = new URLSearchParams({ page: '1', limit: '5000' });
    if (selectedEmployment.length > 0) p.set('employmentType', selectedEmployment.join(','));
    if (selectedCategory.length > 0)   p.set('category', selectedCategory.join(','));
    return `/api/jobs?${p}`;
  }, [selectedEmployment, selectedCategory]);

  const PAGE_SIZE = 25;

  const { data, isLoading, error } = useSWR<JobsResponse>(
    swrKey,
    (url: string) => api.get<JobsResponse>(url),
  );

  // Client-side soft filtering
  const filtered = React.useMemo(() => {
    if (!data?.jobs) return [];
    let jobs = data.jobs;

    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter((j) => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q));
    }
    if (selectedEmployment.length > 0) {
      jobs = jobs.filter((j) => selectedEmployment.includes(j.employmentType));
    }
    if (selectedCategory.length > 0) {
      jobs = jobs.filter((j) => selectedCategory.includes(j.jobCategory));
    }
    if (selectedWorkplace.length > 0) {
      jobs = jobs.filter((j) => j.workplaceType && selectedWorkplace.includes(j.workplaceType));
    }
    if (dateFilter !== 'any') {
      jobs = jobs.filter((j) => isWithinDate(j.postedAt, dateFilter));
    }
    if (salaryMin) {
      const min = Number(salaryMin);
      jobs = jobs.filter((j) => !j.salaryMin || Number(j.salaryMin) >= min);
    }
    if (salaryMax) {
      const max = Number(salaryMax);
      jobs = jobs.filter((j) => !j.salaryMax || Number(j.salaryMax) <= max);
    }
    if (selectedSources.length > 0) {
      jobs = jobs.filter((j) => {
        const src = j.sourceType.toLowerCase();
        return selectedSources.some((s) => src === s || src === `${s}_scraper`);
      });
    }
    if (selectedLocations.length > 0) {
      jobs = jobs.filter((j) => selectedLocations.some((loc) => locationMatches(j.location, loc, j.country)));
    }

    // Sort: watchlisted companies float to the top (when enabled)
    if (prioritizeWatchlist && watchlistData?.items?.length) {
      const watchlistedNames = new Set(
        watchlistData.items
          .filter((i) => i.itemType === 'company')
          .map((i) => i.value.toLowerCase()),
      );
      if (watchlistedNames.size > 0) {
        jobs = [...jobs].sort((a, b) => {
          const aWatched = watchlistedNames.has(a.company.toLowerCase()) ? 0 : 1;
          const bWatched = watchlistedNames.has(b.company.toLowerCase()) ? 0 : 1;
          return aWatched - bWatched;
        });
      }
    }

    return jobs;
  }, [data, search, selectedEmployment, selectedCategory, selectedWorkplace, dateFilter, salaryMin, salaryMax, selectedSources, selectedLocations, profile, watchlistData, prioritizeWatchlist]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedJobs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Active filter pills
  const activePills: { key: string; label: string; onRemove: () => void }[] = [
    ...selectedLocations.map((loc) => ({
      key: `loc-${loc}`,
      label: `📍 ${loc}`,
      onRemove: () => { setSelectedLocations((p) => p.filter((x) => x !== loc)); setPage(1); },
    })),
    ...selectedEmployment.map((id) => ({
      key: `emp-${id}`,
      label: EMPLOYMENT_TYPES.find((t) => t.id === id)?.label ?? id,
      onRemove: () => { setSelectedEmployment((p) => p.filter((x) => x !== id)); setPage(1); },
    })),
    ...selectedCategory.map((id) => ({
      key: `cat-${id}`,
      label: JOB_CATEGORIES.find((c) => c.id === id)?.label ?? id,
      onRemove: () => { setSelectedCategory((p) => p.filter((x) => x !== id)); setPage(1); },
    })),
    ...selectedWorkplace.map((id) => ({
      key: `wp-${id}`,
      label: WORKPLACE_TYPES.find((w) => w.id === id)?.label ?? id,
      onRemove: () => { setSelectedWorkplace((p) => p.filter((x) => x !== id)); setPage(1); },
    })),
    ...(dateFilter !== 'any' ? [{
      key: 'date',
      label: DATE_OPTIONS.find((d) => d.id === dateFilter)?.label ?? dateFilter,
      onRemove: () => setDateFilter('any'),
    }] : []),
    ...(salaryMin ? [{ key: 'sal-min', label: `Min $${salaryMin}`, onRemove: () => setSalaryMin('') }] : []),
    ...(salaryMax ? [{ key: 'sal-max', label: `Max $${salaryMax}`, onRemove: () => setSalaryMax('') }] : []),
    ...selectedSources.map((s) => ({
      key: `src-${s}`,
      label: SOURCE_META[s]?.label ?? s,
      onRemove: () => setSelectedSources((p) => p.filter((x) => x !== s)),
    })),
  ];

  const moreFiltersCount = (salaryMin ? 1 : 0) + (salaryMax ? 1 : 0) + selectedSources.length + selectedWorkplace.length + (dateFilter !== 'any' ? 1 : 0) + (!prioritizeWatchlist ? 1 : 0);

  const router = useRouter();

  async function handleQuickApply(jobId: string) {
    try {
      const result = await api.post<{ draftId?: string; status?: string }>(`/api/jobs/${jobId}/quick-apply`, {});
      if (result.draftId) {
        router.push(`/drafts/${result.draftId}`);
      } else {
        toast({ title: 'Quick Apply queued', description: 'Your application draft has been created.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start Quick Apply';
      toast({ title: 'Quick Apply failed', description: msg, variant: 'destructive' });
    }
  }

  function clearAllFilters() {
    setSearch('');
    setSelectedEmployment([]);
    setSelectedCategory([]);
    setSelectedWorkplace([]);
    setDateFilter('any');
    setSalaryMin(''); setSalaryMax('');
    setSelectedLocations([]);
    setSelectedSources([]);
    setPage(1);
  }

  function toggleFilter<T extends string>(arr: T[], set: React.Dispatch<React.SetStateAction<T[]>>, val: T) {
    set((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
    setPage(1);
  }

  function resetMoreFilters() {
    setSalaryMin(''); setSalaryMax('');
    setSelectedSources([]);
    setSelectedWorkplace([]);
    setPrioritizeWatchlist(false);
    setPage(1);
  }

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('flex-1 flex flex-col min-h-0 transition-all duration-300', selectedJob ? 'mr-[480px]' : '')}>
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-3xl mx-auto flex flex-col min-h-full">
            {/* Header */}
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-tight">Job Board</h1>
              <p className="text-sm text-muted-foreground mt-1">Canadian software & business roles, updated daily</p>
            </div>

            {/* ── Sticky filter bar ── */}
            <div className="sticky top-0 z-10 bg-background pb-3">
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search jobs…"
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-8 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-colors"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter dropdown buttons */}
                <FilterDropdown
                  label="Job Type"
                  activeCount={selectedEmployment.length}
                  isDealBreaker={!!profile?.dealBreakerFields?.employmentTypes}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <DropdownCheckItem
                      key={t.id}
                      label={t.label}
                      checked={selectedEmployment.includes(t.id)}
                      dealBreaker={!!profile?.dealBreakerFields?.employmentTypes}
                      onChange={() => toggleFilter(selectedEmployment, setSelectedEmployment, t.id)}
                    />
                  ))}
                </FilterDropdown>

                <FilterDropdown
                  label="Category"
                  activeCount={selectedCategory.length}
                  isDealBreaker={!!profile?.dealBreakerFields?.jobCategories}
                >
                  {JOB_CATEGORIES.map((c) => (
                    <DropdownCheckItem
                      key={c.id}
                      label={c.label}
                      checked={selectedCategory.includes(c.id)}
                      dealBreaker={!!profile?.dealBreakerFields?.jobCategories}
                      onChange={() => toggleFilter(selectedCategory, setSelectedCategory, c.id)}
                    />
                  ))}
                </FilterDropdown>

                {/* Location dropdown */}
                <LocationDropdown
                  selected={selectedLocations}
                  onAdd={(loc: string) => { setSelectedLocations((p) => p.includes(loc) ? p : [...p, loc]); setPage(1); }}
                  onRemove={(loc: string) => { setSelectedLocations((p) => p.filter((x) => x !== loc)); setPage(1); }}
                />

                {/* More filters */}
                <div className="relative shrink-0">
                  <MoreFiltersButton
                    activeCount={moreFiltersCount}
                    onClick={() => setMoreFiltersOpen(true)}
                  />
                  {moreFiltersOpen && (
                    <MoreFiltersPopover
                      salaryMin={salaryMin}
                      salaryMax={salaryMax}
                      selectedSources={selectedSources}
                      selectedWorkplace={selectedWorkplace}
                      dateFilter={dateFilter}
                      prioritizeWatchlist={prioritizeWatchlist}
                      onSalaryMinChange={setSalaryMin}
                      onSalaryMaxChange={setSalaryMax}
                      onToggleSource={(s: string) => { setSelectedSources((p) => p.includes(s) ? p.filter((x: string) => x !== s) : [...p, s]); setPage(1); }}
                      onToggleWorkplace={(w: string) => { setSelectedWorkplace((p) => p.includes(w) ? p.filter((x: string) => x !== w) : [...p, w]); setPage(1); }}
                      onDateChange={(d) => { setDateFilter(d); setPage(1); }}
                      onTogglePrioritizeWatchlist={() => setPrioritizeWatchlist((p) => !p)}
                      onReset={resetMoreFilters}
                      onClose={() => setMoreFiltersOpen(false)}
                    />
                  )}
                </div>

                {/* Clear all */}
                {(activePills.length > 0) && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 transition-colors ml-auto"
                  >
                    <X className="h-3 w-3" />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Job list */}
            {isLoading && !error && (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[76px] rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            )}

            <div className="flex-1 flex flex-col">
              {(!isLoading || error) && filtered.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No jobs found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
                </div>
              )}

              {(!isLoading || error) && filtered.length > 0 && (
                <div className="space-y-2">
                  {pagedJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      selected={selectedJob?.id === job.id}
                      onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                      onQuickApply={handleQuickApply}
                      isWatched={!!watchlistData?.items?.some((i) => i.itemType === 'company' && i.value.toLowerCase() === job.company.toLowerCase())}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {data && (
              <div className="flex items-center justify-between mt-6">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="gap-1">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {filtered.length} jobs total</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="gap-1">
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Job detail slide-over */}
      {selectedJob && (
        <JobDetailPanel job={selectedJob} onClose={() => setSelectedJob(null)} onQuickApply={handleQuickApply} />
      )}

    </div>
  );
}

// ─── FilterDropdown ───────────────────────────────────────────────────────────

function FilterDropdown({
  label, activeCount, isDealBreaker = false, children,
}: {
  label: string;
  activeCount: number;
  isDealBreaker?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const active = activeCount > 0;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
          active
            ? 'border-primary/50 bg-primary/8 text-primary'
            : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
        )}
      >
        {active && isDealBreaker && <Lock className="h-3 w-3" />}
        {label}
        {active && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold bg-primary text-primary-foreground">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[180px] rounded-xl border border-border bg-background shadow-lg p-1.5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── DropdownCheckItem ────────────────────────────────────────────────────────

function DropdownCheckItem({
  label, checked, dealBreaker = false, onChange,
}: {
  label: string;
  checked: boolean;
  dealBreaker?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors text-left',
        checked ? 'bg-primary/8 text-primary font-medium' : 'text-foreground hover:bg-accent',
      )}
    >
      <div className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked ? 'border-primary bg-primary' : 'border-border',
      )}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <span className="flex-1">{label}</span>
      {checked && dealBreaker && <Lock className="h-3 w-3 shrink-0 text-primary" />}
    </button>
  );
}

// ─── Location dropdown ────────────────────────────────────────────────────────

const LOCATION_SUGGESTIONS = [
  'Canada', 'United States', 'Remote',
  'Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Ottawa, ON', 'Calgary, AB', 'Edmonton, AB', 'Waterloo, ON',
  'New York, NY', 'San Francisco, CA', 'Seattle, WA', 'Austin, TX', 'Boston, MA', 'Chicago, IL', 'Los Angeles, CA',
];

function LocationDropdown({ selected, onAdd, onRemove }: {
  selected: string[];
  onAdd: (loc: string) => void;
  onRemove: (loc: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter' && query.trim() && open) {
        onAdd(query.trim());
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onMouse); window.removeEventListener('keydown', onKey); };
  }, [open, query, onAdd]);

  const suggestions = query.trim()
    ? LOCATION_SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.toLowerCase()) && !selected.includes(s))
    : LOCATION_SUGGESTIONS.filter((s) => !selected.includes(s)).slice(0, 8);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { setOpen((p) => !p); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all shrink-0',
          selected.length > 0 || open
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
        )}
      >
        <MapPin className="h-3.5 w-3.5" />
        Location
        {selected.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-[280px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-popover-in">
          {/* Search input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Country or city…"
                className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>
          </div>

          {/* Selected tags */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1">
              {selected.map((loc) => (
                <span key={loc} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {loc}
                  <button type="button" onClick={() => onRemove(loc)} className="hover:text-primary/60 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Suggestions list */}
          <div className="max-h-[220px] overflow-y-auto py-1.5">
            {query.trim() && !LOCATION_SUGGESTIONS.some((s) => s.toLowerCase() === query.toLowerCase()) && (
              <button
                type="button"
                onClick={() => { onAdd(query.trim()); setQuery(''); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left text-primary hover:bg-accent transition-colors"
              >
                <span className="text-muted-foreground">Add</span> &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {suggestions.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => { onAdd(loc); setQuery(''); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left text-foreground hover:bg-accent transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {loc}
              </button>
            ))}
            {suggestions.length === 0 && query.trim() && (
              <p className="px-3 py-3 text-sm text-muted-foreground text-center">No matches — press Enter to add</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── More filters button + popover ───────────────────────────────────────────

const ALL_SOURCES = (() => {
  const seen = new Set<string>();
  return Object.entries(SOURCE_META)
    .filter(([key]) => !key.endsWith('_scraper'))
    .filter(([, meta]) => {
      if (seen.has(meta.label)) return false;
      seen.add(meta.label);
      return true;
    })
    .map(([id, meta]) => ({ id, label: meta.label }));
})();

function MoreFiltersButton({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all shrink-0',
        activeCount > 0
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      More filters
      {activeCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {activeCount}
        </span>
      )}
    </button>
  );
}

// ─── Collapsible section used inside the popover ──────────────────────────────

function CollapsibleSection({ title, activeCount, children }: {
  title: string;
  activeCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between w-full py-3 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {activeCount != null && activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="pb-3 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function MoreFiltersPopover({
  salaryMin, salaryMax, selectedSources, selectedWorkplace, dateFilter, prioritizeWatchlist,
  onSalaryMinChange, onSalaryMaxChange, onToggleSource, onToggleWorkplace, onDateChange,
  onTogglePrioritizeWatchlist, onReset, onClose,
}: {
  salaryMin: string;
  salaryMax: string;
  selectedSources: string[];
  selectedWorkplace: string[];
  dateFilter: DateFilter;
  prioritizeWatchlist: boolean;
  onSalaryMinChange: (v: string) => void;
  onSalaryMaxChange: (v: string) => void;
  onToggleSource: (s: string) => void;
  onToggleWorkplace: (w: string) => void;
  onDateChange: (d: DateFilter) => void;
  onTogglePrioritizeWatchlist: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1.5 z-50 animate-popover-in"
    >
      <div className="w-[340px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Body */}
        <div className="max-h-[520px] overflow-y-auto px-5 divide-y divide-border">
          {/* Date Posted */}
          <CollapsibleSection title="Date Posted" activeCount={dateFilter !== 'any' ? 1 : 0}>
            {DATE_OPTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onDateChange(d.id)}
                className={cn(
                  'flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors text-left',
                  dateFilter === d.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent',
                )}
              >
                <div className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                  dateFilter === d.id ? 'border-primary bg-primary' : 'border-border',
                )}>
                  {dateFilter === d.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                {d.label}
              </button>
            ))}
          </CollapsibleSection>

          {/* Workplace */}
          <CollapsibleSection title="Workplace" activeCount={selectedWorkplace.length}>
            {WORKPLACE_TYPES.map((w) => (
              <PopoverCheckItem
                key={w.id}
                label={w.label}
                checked={selectedWorkplace.includes(w.id)}
                onChange={() => onToggleWorkplace(w.id)}
              />
            ))}
          </CollapsibleSection>

          {/* Salary */}
          <CollapsibleSection title="Salary" activeCount={(salaryMin ? 1 : 0) + (salaryMax ? 1 : 0)}>
            <div className="flex items-center gap-2 pt-1 pb-2">
              <div className="relative flex-1">
                <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => onSalaryMinChange(e.target.value)}
                  placeholder="Min"
                  className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
              </div>
              <span className="text-muted-foreground text-sm shrink-0">—</span>
              <div className="relative flex-1">
                <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => onSalaryMaxChange(e.target.value)}
                  placeholder="Max"
                  className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pb-1">CAD per year</p>
          </CollapsibleSection>

          {/* Watchlist priority */}
          <CollapsibleSection title="Watchlist" activeCount={prioritizeWatchlist ? 0 : 0}>
            <button
              type="button"
              onClick={onTogglePrioritizeWatchlist}
              className="flex items-center justify-between w-full rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent"
            >
              <span className="text-foreground">Prioritize watchlisted companies</span>
              <div className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                prioritizeWatchlist ? 'bg-primary' : 'bg-input',
              )}>
                <span className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
                  prioritizeWatchlist ? 'translate-x-4' : 'translate-x-0',
                )} />
              </div>
            </button>
          </CollapsibleSection>

          {/* Job source */}
          <CollapsibleSection title="Job Source" activeCount={selectedSources.length}>
            {ALL_SOURCES.map((src) => (
              <PopoverCheckItem
                key={src.id}
                label={src.label}
                checked={selectedSources.includes(src.id)}
                onChange={() => onToggleSource(src.id)}
              />
            ))}
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-card">
          <button
            onClick={onReset}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PopoverCheckItem({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors text-left',
        checked ? 'text-primary font-medium' : 'text-foreground hover:bg-accent',
      )}
    >
      <div className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
        checked ? 'border-primary bg-primary' : 'border-muted-foreground/40',
      )}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      {label}
    </button>
  );
}

// ─── Apply button (resolves LinkedIn → ATS URL) ───────────────────────────────

function ApplyButton({ job, className, label = 'Apply', iconSize = 'h-3 w-3' }: {
  job: Job;
  className?: string;
  label?: string;
  iconSize?: string;
}) {
  const [resolving, setResolving] = React.useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (!/linkedin\.com/i.test(job.applyUrl)) {
      window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setResolving(true);
    try {
      const result = await api.get<{ applyUrl: string }>(`/api/jobs/${job.id}/resolve-apply-url`);
      window.open(result.applyUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setResolving(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={resolving} className={className}>
      {resolving ? <Loader2 className={`${iconSize} animate-spin`} /> : <ExternalLink className={iconSize} />}
      {label}
    </button>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, selected, onClick, onQuickApply, isWatched }: { job: Job; selected: boolean; onClick: () => void; onQuickApply: (jobId: string) => void; isWatched?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all cursor-pointer',
        selected
          ? 'border-primary/60 bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/30 hover:bg-accent/20',
      )}
    >
      <CompanyLogo company={job.company} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{job.title}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.company}</span>
              {isWatched && (
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <EmploymentBadge type={job.employmentType} />
            <WorkplaceBadge type={job.workplaceType} />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1 truncate max-w-[160px]">
              <MapPin className="h-3 w-3 shrink-0" />
              {job.location}
            </span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(job.postedAt)}
            </span>
          )}
          <SourceBadge source={job.sourceType} />
          <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <ApplyButton job={job} className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors" />
            <button
              onClick={(e) => { e.stopPropagation(); onQuickApply(job.id); }}
              className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Zap className="h-3 w-3" />
              Quick Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Keyword extraction ───────────────────────────────────────────────────────

const KEYWORD_LIST = [
  // Languages
  'Python', 'TypeScript', 'JavaScript', 'Java', 'Go', 'Golang', 'Rust', 'C++', 'C#', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'PHP', 'R',
  // Frontend
  'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Tailwind', 'CSS', 'HTML', 'Webpack', 'Vite',
  // Backend / runtime
  'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Spring', 'Rails', 'GraphQL', 'REST', 'gRPC',
  // Data / ML
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Spark', 'Kafka', 'Airflow', 'dbt',
  'TensorFlow', 'PyTorch', 'scikit-learn', 'pandas', 'NumPy',
  // Cloud / DevOps
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'GitHub Actions', 'Linux', 'Bash',
  // Tools / practices
  'Git', 'Agile', 'Scrum', 'Jira', 'Figma', 'Storybook', 'Jest', 'Cypress', 'Playwright',
];

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return KEYWORD_LIST.filter((kw) => {
    const lkw = kw.toLowerCase();
    // Whole-word match — escape all special regex chars
    const escaped = lkw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`);
    return re.test(lower);
  });
}

type SalaryUnit = 'annual' | 'monthly' | 'hourly';
interface ParsedSalary { min: number | null; max: number | null; unit: SalaryUnit; }

function extractSalaryFromText(text: string): ParsedSalary {
  if (!text) return { min: null, max: null, unit: 'annual' };

  // Strip currency labels so "$11,700 USD" parses cleanly
  const t = text.replace(/\b(USD|CAD|usd|cad)\b/g, '');

  // ── Hourly ──  $42 / $42.50 per hour / $42/hr / $42 an hour / $42/h
  const hourlyRange = t.match(/\$(\d[\d,]*(?:\.\d+)?)\s*(?:–|-|to)\s*\$(\d[\d,]*(?:\.\d+)?)\s*(?:per\s+hour|\/hour|\/hr?|an\s+hour)/i);
  if (hourlyRange) {
    const a = parseFloat(hourlyRange[1]!.replace(/,/g, ''));
    const b = parseFloat(hourlyRange[2]!.replace(/,/g, ''));
    return { min: Math.round(a * 2080), max: Math.round(b * 2080), unit: 'hourly' };
  }
  const hourlySingle = t.match(/\$(\d[\d,]*(?:\.\d+)?)\s*(?:per\s+hour|\/hour|\/hr?|an\s+hour)/i);
  if (hourlySingle) {
    const v = parseFloat(hourlySingle[1]!.replace(/,/g, ''));
    if (v >= 10) return { min: Math.round(v * 2080), max: null, unit: 'hourly' };
  }

  // ── Monthly ──  $11,700 per month / $11,700/month / $11,700/mo
  const monthlyRange = t.match(/\$(\d[\d,]*)\s*(?:–|-|to)\s*\$(\d[\d,]*)\s*(?:per\s+month|\/month|\/mo\b)/i);
  if (monthlyRange) {
    const a = parseInt(monthlyRange[1]!.replace(/,/g, ''), 10);
    const b = parseInt(monthlyRange[2]!.replace(/,/g, ''), 10);
    return { min: a * 12, max: b * 12, unit: 'monthly' };
  }
  const monthlySingle = t.match(/\$(\d[\d,]*)\s*(?:per\s+month|\/month|\/mo\b)/i);
  if (monthlySingle) {
    const v = parseInt(monthlySingle[1]!.replace(/,/g, ''), 10);
    if (v >= 500) return { min: v * 12, max: null, unit: 'monthly' };
  }

  // ── Hourly (context before) ──  "hourly rate … $45 - $60"
  const hourlyCtxBefore = t.match(/hourly[^$\n]{0,80}\$(\d[\d,]*)\s*[-–—]\s*\$(\d[\d,]*)/i);
  if (hourlyCtxBefore) {
    const a = parseInt(hourlyCtxBefore[1]!.replace(/,/g, ''), 10);
    const b = parseInt(hourlyCtxBefore[2]!.replace(/,/g, ''), 10);
    if (a >= 10 && a < 500) return { min: a * 2080, max: b * 2080, unit: 'hourly' };
  }
  // ── Hourly (context after) ──  "$45 – $60 hourly" / "$45 – $60 per hour"
  const hourlyCtxAfter = t.match(/\$(\d[\d,]*)\s*[-–—]\s*\$(\d[\d,]*)[^\n]{0,60}(?:per\s+hour|hourly|\/hr?)\b/i);
  if (hourlyCtxAfter) {
    const a = parseInt(hourlyCtxAfter[1]!.replace(/,/g, ''), 10);
    const b = parseInt(hourlyCtxAfter[2]!.replace(/,/g, ''), 10);
    if (a >= 10 && a < 500) return { min: a * 2080, max: b * 2080, unit: 'hourly' };
  }

  // ── Annual range ──  $120,000 – $160,000  or  $120k – $160k
  const annualRange = t.match(/\$(\d[\d,]*)\s*k?\s*[-–—]\s*\$(\d[\d,]*)\s*k?/i);
  if (annualRange) {
    const parse = (s: string, hasK: boolean) => { const n = parseInt(s.replace(/,/g, ''), 10); return hasK || n < 1000 ? n * 1000 : n; };
    const hasK = /k/i.test(annualRange[0]);
    return { min: parse(annualRange[1]!, hasK), max: parse(annualRange[2]!, hasK), unit: 'annual' };
  }

  // ── Single annual ──  $90k/yr  or  $120,000
  const singleMatch = t.match(/\$(\d[\d,]+)\s*k?(?:\/yr|\/year|per\s+year)?/i);
  if (singleMatch) {
    const raw = parseInt(singleMatch[1]!.replace(/,/g, ''), 10);
    const val = /k/i.test(singleMatch[0]) ? raw * 1000 : raw;
    if (val >= 30000) return { min: val, max: null, unit: 'annual' };
  }

  return { min: null, max: null, unit: 'annual' };
}

// ─── Job detail slide-over ────────────────────────────────────────────────────

function JobDetailPanel({ job, onClose, onQuickApply }: { job: Job; onClose: () => void; onQuickApply: (jobId: string) => void }) {
  const { data: salary, isLoading: salaryLoading } = useSWR<SalaryData>(
    `/api/jobs/salary?title=${encodeURIComponent(job.title)}&location=${encodeURIComponent(job.location)}&jobId=${job.id}`,
    (url: string) => api.get<SalaryData>(url),
  );

  // Fetch description on-demand only when descriptionPlain is empty
  const needsFetch = !job.descriptionPlain.trim();
  const { data: fetchedDesc, isLoading: descLoading } = useSWR<{ text: string }>(
    needsFetch ? `/api/jobs/description?url=${encodeURIComponent(job.jobUrl)}` : null,
    (url: string) => fetch(url).then((r) => r.json() as Promise<{ text: string }>),
  );

  const descriptionText = job.descriptionPlain.trim() || fetchedDesc?.text?.trim() || '';

  const descParagraphs = React.useMemo(
    () => descriptionText.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
    [descriptionText],
  );

  const keywords = React.useMemo(() => extractKeywords(descriptionText), [descriptionText]);

  const salaryFromDesc = React.useMemo<ParsedSalary>(() => extractSalaryFromText(descriptionText), [descriptionText]);

  // Close on Escape
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const salaryDisplay = React.useMemo(() => {
    if (salaryLoading) return null;
    if (salary?.min || salary?.max || salary?.median) {
      const { min, max, median } = salary;
      if (median) return `$${(median / 1000).toFixed(0)}K/yr median`;
      if (min && max) return `$${(min / 1000).toFixed(0)}K – $${(max / 1000).toFixed(0)}K/yr`;
      if (min) return `From $${(min / 1000).toFixed(0)}K/yr`;
      if (max) return `Up to $${(max / 1000).toFixed(0)}K/yr`;
    }
    // Fall back to salary extracted from description text
    if (salaryFromDesc.min || salaryFromDesc.max) {
      const { min, max, unit } = salaryFromDesc;
      if (unit === 'hourly') {
        // Display the raw hourly rate, not the annualised value
        const rawMin = min ? Math.round(min / 2080) : null;
        const rawMax = max ? Math.round(max / 2080) : null;
        if (rawMin && rawMax) return `$${rawMin} – $${rawMax}/hr`;
        if (rawMin) return `$${rawMin}/hr`;
      } else if (unit === 'monthly') {
        const rawMin = min ? Math.round(min / 12) : null;
        const rawMax = max ? Math.round(max / 12) : null;
        if (rawMin && rawMax) return `$${(rawMin / 1000).toFixed(1)}K – $${(rawMax / 1000).toFixed(1)}K/mo`;
        if (rawMin) return `$${(rawMin / 1000).toFixed(1)}K/mo`;
      } else {
        if (min && max) return `$${(min / 1000).toFixed(0)}K – $${(max / 1000).toFixed(0)}K/yr`;
        if (min) return `From $${(min / 1000).toFixed(0)}K/yr`;
        if (max) return `Up to $${(max / 1000).toFixed(0)}K/yr`;
      }
    }
    return null;
  }, [salary, salaryLoading, salaryFromDesc]);

  const salarySource = salary?.source ?? (salaryFromDesc.min || salaryFromDesc.max ? 'job_posting' : null);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-40 w-[480px] bg-background border-l border-border flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-border">
          <CompanyLogo company={job.company} size={52} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base leading-snug">{job.title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <EmploymentBadge type={job.employmentType} />
              <WorkplaceBadge type={job.workplaceType} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Meta strip */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-border text-xs text-muted-foreground bg-muted/30 flex-wrap">
          {job.location && (
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatRelativeTime(job.postedAt)}</span>
          )}
          <SourceBadge source={job.sourceType} />
        </div>

        {/* Salary card */}
        <div className="px-5 pt-4">
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Estimated Salary</p>
              {salaryLoading ? (
                <div className="h-4 w-28 bg-muted rounded animate-pulse mt-0.5" />
              ) : salaryDisplay ? (
                <p className="text-sm font-semibold text-foreground">{salaryDisplay}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Not disclosed</p>
              )}
              {salarySource === 'linkedin' && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Source: LinkedIn Salary Insights</p>
              )}
              {salarySource === 'job_posting' && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Source: Job posting</p>
              )}
            </div>
          </div>
        </div>

        {/* Description + Keywords */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Description */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Job Description
            </div>
            {(needsFetch && descLoading) ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn('h-3 bg-muted rounded animate-pulse', i % 3 === 2 ? 'w-3/4' : 'w-full')} />
                ))}
              </div>
            ) : descParagraphs.length > 0 ? (
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                {descParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description available — view the full posting for details.</p>
            )}
          </div>

          {/* Keywords */}
          {keywords.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Skills & Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-foreground/80 font-medium"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t border-border flex items-center gap-3 bg-background">
          <ApplyButton job={job} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium hover:bg-accent transition-colors" label="View posting" iconSize="h-4 w-4" />
          <button
            onClick={() => onQuickApply(job.id)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Zap className="h-4 w-4" />
            Quick Apply
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function EmploymentBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' }> = {
    full_time:  { label: 'Full-time',  variant: 'secondary' },
    part_time:  { label: 'Part-time',  variant: 'secondary' },
    internship: { label: 'Internship', variant: 'warning' },
    co_op:      { label: 'Co-op',      variant: 'warning' },
    contract:   { label: 'Contract',   variant: 'secondary' },
  };
  const cfg = map[type] ?? { label: type, variant: 'secondary' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function WorkplaceBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const map: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };
  return <Badge variant="outline">{map[type] ?? type}</Badge>;
}

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source?.toLowerCase()] ?? { label: source, color: 'text-muted-foreground' };
  return (
    <span className={cn('flex items-center gap-1 font-medium shrink-0', meta.color)}>
      <Radio className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

