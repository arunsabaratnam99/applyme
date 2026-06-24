'use client';

import React from 'react';
import useSWR from 'swr';
import {
  MapPin,
  Search, X, ChevronLeft, ChevronRight, DollarSign,
  Briefcase, ChevronDown, SlidersHorizontal,
  Lock, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  JobCard,
  JobDetailPanel,
  SOURCE_META,
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  WORKPLACE_TYPES,
  type Job,
  type JobsResponse,
} from '@/components/jobs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  employmentTypes: string[] | null;
  jobCategories: string[] | null;
  locations: string[] | null;
  dealBreakerFields: { employmentTypes: boolean; jobCategories: boolean; workplaceType: boolean } | null;
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

  // Client-side cache of resolved ATS URLs keyed by job ID.
  // Pre-warmed in background when pagedJobs changes so Apply clicks are instant.
  const resolvedUrlCache = React.useRef<Map<string, string>>(new Map());

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
                      isWatched={!!watchlistData?.items?.some((i) => i.itemType === 'company' && i.value.toLowerCase() === job.company.toLowerCase())}
                      resolvedUrls={resolvedUrlCache.current}
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
        <JobDetailPanel job={selectedJob} onClose={() => setSelectedJob(null)} resolvedUrls={resolvedUrlCache.current} />
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
