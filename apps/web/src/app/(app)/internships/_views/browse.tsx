'use client';

import React from 'react';
import useSWR from 'swr';
import {
  Search,
  X,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Columns3,
  GripVertical,
  Bookmark,
  BookmarkCheck,
  Github,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import {
  CompanyLogo,
  ApplyButton,
  JobDetailPanel,
  type Job,
  type JobsResponse,
} from '@/components/jobs';

interface SavedJobsResponse {
  items: Array<{ jobId: string }>;
}

type ApplicationStatus = 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'applied',    label: 'Applied' },
  { value: 'interview',  label: 'Interview' },
  { value: 'offer',      label: 'Offer' },
  { value: 'rejected',   label: 'Rejected' },
  { value: 'withdrawn',  label: 'Withdrawn' },
];

const STATUS_BADGE: Record<ApplicationStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'muted'> = {
  applied:    'default',
  interview:  'warning',
  offer:      'success',
  rejected:   'destructive',
  withdrawn:  'muted',
};

interface Application {
  id: string;
  status: ApplicationStatus;
  applyMethod: string;
  appliedAt: string | null;
  job: { id: string } | null;
  jobId?: string;
}

interface ApplicationsResponse {
  applications: Application[];
  page: number;
  limit: number;
}

interface ColumnPref { id: string; visible: boolean; width?: number }
interface TablePrefs {
  columns: ColumnPref[];
  sort: { columnId: string; dir: 'asc' | 'desc' } | null;
}

interface ColumnDef {
  id: string;
  label: string;
  toggleable: boolean;
  sortable: boolean;
  width?: number;
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { id: 'logo',           label: '',              toggleable: false, sortable: false, width: 56,  className: 'w-14' },
  { id: 'company',        label: 'Company',       toggleable: true,  sortable: true,            className: 'min-w-[140px]' },
  { id: 'title',          label: 'Title',         toggleable: true,  sortable: true,            className: 'min-w-[220px]' },
  { id: 'location',       label: 'Location',      toggleable: true,  sortable: true,            className: 'min-w-[140px]' },
  { id: 'postedAt',       label: 'Posted',        toggleable: true,  sortable: true,            className: 'min-w-[110px]' },
  { id: 'repo',           label: 'Source',        toggleable: true,  sortable: true,            className: 'min-w-[220px]' },
  { id: 'status',         label: 'Status',        toggleable: true,  sortable: true,            className: 'min-w-[160px]' },
  { id: 'salary',         label: 'Salary',        toggleable: true,  sortable: true,            className: 'min-w-[120px]' },
  { id: 'workplaceType',  label: 'Workplace',     toggleable: true,  sortable: true,            className: 'min-w-[100px]' },
  { id: 'country',        label: 'Country',       toggleable: true,  sortable: true,            className: 'min-w-[90px]' },
  { id: 'actions',        label: '',              toggleable: false, sortable: false, width: 64, className: 'w-16' },
];

const COLUMN_BY_ID = new Map(COLUMNS.map((c) => [c.id, c]));

const DEFAULT_VISIBLE = new Set(['logo', 'company', 'title', 'location', 'postedAt', 'repo', 'status', 'actions']);

function defaultPrefs(): TablePrefs {
  return {
    columns: COLUMNS.map((c) => ({ id: c.id, visible: DEFAULT_VISIBLE.has(c.id) })),
    sort: { columnId: 'postedAt', dir: 'desc' },
  };
}

function reconcilePrefs(saved: TablePrefs | null): TablePrefs {
  if (!saved) return defaultPrefs();
  const seen = new Set<string>();
  const merged: ColumnPref[] = [];
  for (const c of saved.columns ?? []) {
    if (COLUMN_BY_ID.has(c.id) && !seen.has(c.id)) {
      seen.add(c.id);
      merged.push({ id: c.id, visible: c.visible, width: c.width });
    }
  }
  for (const c of COLUMNS) {
    if (!seen.has(c.id)) merged.push({ id: c.id, visible: DEFAULT_VISIBLE.has(c.id) });
  }
  return { columns: merged, sort: saved.sort ?? defaultPrefs().sort };
}

const PAGE_SIZE = 100;

export function BrowseView() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const [prefs, setPrefs] = React.useState<TablePrefs>(defaultPrefs);
  const prefsLoaded = React.useRef(false);
  const resolvedUrlCache = React.useRef<Map<string, string>>(new Map());

  // ─── Data ─────────────────────────────────────────────────────────────────

  const jobsKey = React.useMemo(() => {
    const p = new URLSearchParams({ page: '1', limit: '5000', employmentType: 'internship,co_op' });
    return `/api/jobs?${p}`;
  }, []);

  const { data: jobsData, isLoading, error, mutate: mutateJobs } = useSWR<JobsResponse>(
    jobsKey,
    (url: string) => api.get<JobsResponse>(url),
  );

  const { data: appsData, mutate: mutateApps } = useSWR<ApplicationsResponse>(
    '/api/applications?page=1&limit=500',
    (url: string) => api.get<ApplicationsResponse>(url),
  );

  const { data: savedData, mutate: mutateSaved } = useSWR<SavedJobsResponse>(
    '/api/saved-jobs',
    (url: string) => api.get<SavedJobsResponse>(url),
  );

  const { data: prefsData } = useSWR<{ config: TablePrefs | null }>(
    '/api/table-preferences/internships',
    (url: string) => api.get<{ config: TablePrefs | null }>(url),
    { revalidateOnFocus: false },
  );

  React.useEffect(() => {
    if (!prefsData || prefsLoaded.current) return;
    prefsLoaded.current = true;
    setPrefs(reconcilePrefs(prefsData.config));
  }, [prefsData]);

  // Persist prefs (debounced) once loaded.
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put('/api/table-preferences/internships', prefs).catch(() => {
        // non-fatal — user can change it again next time.
      });
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [prefs]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const savedIds = React.useMemo(
    () => new Set(savedData?.items?.map((i) => i.jobId) ?? []),
    [savedData],
  );

  const appsByJobId = React.useMemo(() => {
    const m = new Map<string, Application>();
    for (const a of appsData?.applications ?? []) {
      const jid = a.job?.id ?? a.jobId;
      if (jid) m.set(jid, a);
    }
    return m;
  }, [appsData]);

  const visibleColumns = React.useMemo(
    () => prefs.columns.filter((c) => c.visible).map((c) => COLUMN_BY_ID.get(c.id)!).filter(Boolean),
    [prefs.columns],
  );

  const filtered = React.useMemo(() => {
    if (!jobsData?.jobs) return [];
    let jobs = jobsData.jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter(
        (j) => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q),
      );
    }
    return jobs;
  }, [jobsData, search]);

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    const sort = prefs.sort;
    if (!sort) return arr;
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = sortValue(a, sort.columnId, appsByJobId);
      const bv = sortValue(b, sort.columnId, appsByJobId);
      const r = compareValues(av, bv);
      if (r !== 0) return r * dir;
      // tie-break newest first
      return compareValues(sortValue(a, 'postedAt', appsByJobId), sortValue(b, 'postedAt', appsByJobId)) * -1;
    });
    return arr;
  }, [filtered, prefs.sort, appsByJobId]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pagedJobs = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  React.useEffect(() => { setPage(1); }, [search]);

  // ─── Mutations ────────────────────────────────────────────────────────────

  async function toggleSave(job: Job) {
    const wasSaved = savedIds.has(job.id);
    await mutateSaved(
      (prev) => {
        const items = prev?.items ?? [];
        return {
          items: wasSaved
            ? items.filter((i) => i.jobId !== job.id)
            : [...items, { jobId: job.id }],
        };
      },
      { revalidate: false },
    );
    try {
      if (wasSaved) await api.delete(`/api/saved-jobs/${job.id}`);
      else await api.post('/api/saved-jobs', { jobId: job.id });
    } finally {
      mutateSaved();
    }
  }

  async function updateStatus(application: Application, next: ApplicationStatus) {
    const prev = application.status;
    if (prev === next) return;
    await mutateApps(
      (cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          applications: cur.applications.map((a) => (a.id === application.id ? { ...a, status: next } : a)),
        };
      },
      { revalidate: false },
    );
    try {
      await api.patch(`/api/applications/${application.id}`, { status: next });
      toast({ title: 'Status updated', description: `Now ${labelFor(next)}` });
    } catch {
      await mutateApps(
        (cur) => {
          if (!cur) return cur;
          return {
            ...cur,
            applications: cur.applications.map((a) => (a.id === application.id ? { ...a, status: prev } : a)),
          };
        },
        { revalidate: false },
      );
      toast({ title: 'Failed to update status', variant: 'destructive' });
    } finally {
      mutateApps();
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      await Promise.all([mutateJobs(), mutateApps(), mutateSaved()]);
    } finally {
      setRefreshing(false);
    }
  }

  // ─── Column controls ──────────────────────────────────────────────────────

  function toggleColumn(id: string) {
    setPrefs((p) => ({
      ...p,
      columns: p.columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    }));
  }

  function moveColumn(id: string, dir: -1 | 1) {
    setPrefs((p) => {
      const idx = p.columns.findIndex((c) => c.id === id);
      if (idx < 0) return p;
      const target = idx + dir;
      if (target < 0 || target >= p.columns.length) return p;
      const next = [...p.columns];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item!);
      return { ...p, columns: next };
    });
  }

  function setSort(columnId: string) {
    const def = COLUMN_BY_ID.get(columnId);
    if (!def?.sortable) return;
    setPrefs((p) => {
      if (p.sort?.columnId === columnId) {
        return { ...p, sort: { columnId, dir: p.sort.dir === 'asc' ? 'desc' : 'asc' } };
      }
      return { ...p, sort: { columnId, dir: 'desc' } };
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('flex-1 flex flex-col min-h-0 transition-all duration-300', selectedJob ? 'mr-[480px]' : '')}>
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 flex flex-col min-h-full">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Internships and co-ops from curated GitHub source repositories. Add your own under{' '}
                <span className="font-medium text-foreground">Sources</span>.
              </p>
            </div>

            {/* Toolbar */}
            <div className="sticky top-0 z-20 bg-background pb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search internships by title or company…"
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-8 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-colors"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setColumnsOpen((o) => !o)}
                    className="gap-1.5"
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    Columns
                  </Button>
                  {columnsOpen && (
                    <ColumnsPopover
                      prefs={prefs}
                      onClose={() => setColumnsOpen(false)}
                      onToggle={toggleColumn}
                      onMove={moveColumn}
                    />
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAll}
                  disabled={refreshing}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Loading skeleton */}
            {isLoading && !error && (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {(!isLoading || error) && filtered.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <GraduationCap className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No internships found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try a different search, or add a new source repository.
                </p>
              </div>
            )}

            {/* Table */}
            {(!isLoading || error) && filtered.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {visibleColumns.map((col) => (
                        <th
                          key={col.id}
                          className={cn(
                            'text-left font-medium px-3 py-2 whitespace-nowrap',
                            col.className,
                            col.sortable && 'cursor-pointer select-none hover:text-foreground',
                          )}
                          style={col.width ? { width: col.width } : undefined}
                          onClick={col.sortable ? () => setSort(col.id) : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {col.sortable && prefs.sort?.columnId === col.id && (
                              prefs.sort.dir === 'asc'
                                ? <ChevronUp className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3" />
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedJobs.map((job) => {
                      const application = appsByJobId.get(job.id);
                      const isSaved = savedIds.has(job.id);
                      const isSelected = selectedJob?.id === job.id;
                      return (
                        <tr
                          key={job.id}
                          className={cn(
                            'border-t border-border hover:bg-accent/40 transition-colors cursor-pointer',
                            isSelected && 'bg-accent/60',
                          )}
                          onClick={() => setSelectedJob(isSelected ? null : job)}
                        >
                          {visibleColumns.map((col) => (
                            <td
                              key={col.id}
                              className={cn('px-3 py-2 align-middle', col.className)}
                              style={col.width ? { width: col.width } : undefined}
                            >
                              <Cell
                                column={col.id}
                                job={job}
                                application={application}
                                isSaved={isSaved}
                                onToggleSave={toggleSave}
                                onUpdateStatus={updateStatus}
                                resolvedUrls={resolvedUrlCache.current}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {jobsData && filtered.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="gap-1">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {sorted.length} internships total
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="gap-1">
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedJob && (
        <JobDetailPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          resolvedUrls={resolvedUrlCache.current}
        />
      )}
    </div>
  );
}

// ─── Cell renderer ──────────────────────────────────────────────────────────

function Cell({
  column,
  job,
  application,
  isSaved,
  onToggleSave,
  onUpdateStatus,
  resolvedUrls,
}: {
  column: string;
  job: Job;
  application: Application | undefined;
  isSaved: boolean;
  onToggleSave: (job: Job) => void;
  onUpdateStatus: (app: Application, next: ApplicationStatus) => void;
  resolvedUrls: Map<string, string>;
}) {
  switch (column) {
    case 'logo':
      return <CompanyLogo company={job.company} size={32} />;
    case 'company':
      return <span className="font-medium text-foreground">{job.company}</span>;
    case 'title':
      return <span className="text-foreground">{job.title}</span>;
    case 'location':
      return <span className="text-muted-foreground">{job.location || '—'}</span>;
    case 'postedAt':
      return (
        <span className="text-muted-foreground whitespace-nowrap">
          {job.postedAt ? formatRelativeTime(job.postedAt) : '—'}
        </span>
      );
    case 'repo': {
      if (!job.sourceRepo) return <span className="text-muted-foreground">—</span>;
      return (
        <a
          href={`https://github.com/${job.sourceRepo}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-foreground hover:underline"
        >
          <Github className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">{job.sourceRepo}</span>
        </a>
      );
    }
    case 'workplaceType':
      return <span className="text-muted-foreground">{job.workplaceType ? labelWorkplace(job.workplaceType) : '—'}</span>;
    case 'country':
      return <span className="text-muted-foreground uppercase text-xs">{job.country || '—'}</span>;
    case 'salary':
      return <span className="text-muted-foreground">{formatSalary(job.salaryMin, job.salaryMax)}</span>;
    case 'status': {
      if (!application) {
        return (
          <ApplyButton
            job={job}
            label="Apply"
            iconSize="h-3 w-3"
            resolvedUrls={resolvedUrls}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent transition-colors"
          />
        );
      }
      return (
        <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
          <Badge variant={STATUS_BADGE[application.status] ?? 'secondary'}>
            {labelFor(application.status)}
          </Badge>
          <select
            value={application.status}
            onChange={(e) => onUpdateStatus(application, e.target.value as ApplicationStatus)}
            className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    case 'actions':
      return (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onToggleSave(job)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            title={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>
      );
    default:
      return null;
  }
}

// ─── Columns popover ────────────────────────────────────────────────────────

function ColumnsPopover({
  prefs,
  onClose,
  onToggle,
  onMove,
}: {
  prefs: TablePrefs;
  onClose: () => void;
  onToggle: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-border bg-popover shadow-lg p-2"
    >
      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Columns</p>
      <div className="max-h-80 overflow-y-auto">
        {prefs.columns.map((c, idx) => {
          const def = COLUMN_BY_ID.get(c.id);
          if (!def) return null;
          const label = def.label || `(${def.id})`;
          return (
            <div
              key={c.id}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-accent/60"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              <div className="flex flex-col -gap-0.5">
                <button
                  type="button"
                  onClick={() => onMove(c.id, -1)}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                  title="Move up"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(c.id, 1)}
                  disabled={idx === prefs.columns.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                  title="Move down"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={c.visible}
                  disabled={!def.toggleable}
                  onChange={() => onToggle(c.id)}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                <span className={cn(!def.toggleable && 'text-muted-foreground')}>{label}</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sortValue(job: Job, columnId: string, appsByJobId: Map<string, Application>): string | number {
  switch (columnId) {
    case 'company':        return job.company.toLowerCase();
    case 'title':          return job.title.toLowerCase();
    case 'location':       return (job.location || '').toLowerCase();
    case 'country':        return (job.country || '').toLowerCase();
    case 'workplaceType':  return job.workplaceType ?? '';
    case 'repo':           return (job.sourceRepo ?? '').toLowerCase();
    case 'postedAt':       return job.postedAt ? new Date(job.postedAt).getTime() : 0;
    case 'salary': {
      const min = job.salaryMin ? parseFloat(job.salaryMin) : null;
      const max = job.salaryMax ? parseFloat(job.salaryMax) : null;
      return min ?? max ?? 0;
    }
    case 'status': {
      const app = appsByJobId.get(job.id);
      return app?.status ?? 'zzz_not_applied';
    }
    default: return '';
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function labelFor(s: ApplicationStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

function labelWorkplace(t: string): string {
  const map: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };
  return map[t] ?? t;
}

function formatSalary(min: string | null, max: string | null): string {
  const fmt = (s: string) => {
    const n = parseFloat(s);
    if (!isFinite(n)) return s;
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return fmt(min);
  if (max) return fmt(max);
  return '—';
}
