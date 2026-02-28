'use client';

import React from 'react';
import useSWR from 'swr';
import { MapPin, Building2, Clock, ExternalLink, Zap, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';

interface Job {
  id: string;
  company: string;
  title: string;
  location: string;
  workplaceType: string | null;
  jobCategory: string;
  employmentType: string;
  applyUrl: string;
  postedAt: string | null;
  sourceType: string;
}

interface JobsResponse {
  jobs: Job[];
  page: number;
  limit: number;
}

export default function JobsPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useSWR<JobsResponse>(
    `/api/jobs?page=${page}&limit=25`,
    (url: string) => api.get<JobsResponse>(url),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Job Board</h1>
        <p className="text-sm text-muted-foreground mt-1">Canadian software & business roles, updated daily</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="space-y-2">
            {data.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={data.jobs.length < 25}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <div className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30 animate-fade-in">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
        {job.company.slice(0, 2).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm truncate">{job.title}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3" />
              {job.company}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EmploymentBadge type={job.employmentType} />
            <WorkplaceBadge type={job.workplaceType} />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.location}
          </span>
          {job.postedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(job.postedAt)}
            </span>
          )}
          <SourceBadge source={job.sourceType} />
          <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" asChild>
              <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Apply
              </a>
            </Button>
            <Button size="sm" className="h-7 px-2 gap-1">
              <Zap className="h-3 w-3" />
              Quick Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmploymentBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' }> = {
    full_time: { label: 'Full-time', variant: 'secondary' },
    internship: { label: 'Internship', variant: 'warning' },
    co_op: { label: 'Co-op', variant: 'warning' },
  };
  const cfg = map[type] ?? { label: type, variant: 'muted' as const };
  return <Badge variant={cfg.variant as 'default' | 'secondary' | 'warning'}>{cfg.label}</Badge>;
}

function WorkplaceBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const map: Record<string, string> = { remote: '🌐 Remote', hybrid: '🏙 Hybrid', onsite: '🏢 On-site' };
  return <Badge variant="outline">{map[type] ?? type}</Badge>;
}

const SOURCE_META: Record<string, { label: string; color: string }> = {
  linkedin:   { label: 'LinkedIn',   color: 'text-[#0A66C2]' },
  indeed:     { label: 'Indeed',     color: 'text-[#2164F3]' },
  github:     { label: 'GitHub',     color: 'text-foreground' },
  greenhouse: { label: 'Greenhouse', color: 'text-[#3AB060]' },
  lever:      { label: 'Lever',      color: 'text-[#3B49DF]' },
  ashby:      { label: 'Ashby',      color: 'text-[#6B50E8]' },
  workday:    { label: 'Workday',    color: 'text-[#DC5C36]' },
  jobbank:    { label: 'Job Bank',   color: 'text-[#B5121B]' },
};

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source?.toLowerCase()] ?? { label: source, color: 'text-muted-foreground' };
  return (
    <span className={`flex items-center gap-1 font-medium ${meta.color}`}>
      <Radio className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}
