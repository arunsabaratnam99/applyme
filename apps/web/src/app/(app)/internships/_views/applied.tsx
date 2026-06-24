'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRelativeTime, formatStatus } from '@/lib/format';

interface AppliedJob {
  id: string;
  company: string;
  title: string;
  location: string;
  employmentType: string;
}

interface Application {
  id: string;
  status: string;
  applyMethod: string;
  appliedAt: string | null;
  job: AppliedJob | null;
}

interface ApplicationsResponse {
  applications: Application[];
  page: number;
  limit: number;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'muted'> = {
  applied: 'default',
  interviewing: 'warning',
  offer: 'success',
  rejected: 'destructive',
  withdrawn: 'muted',
};

const INTERN_TYPES = new Set(['internship', 'co_op']);

export function AppliedView() {
  const { data, isLoading } = useSWR<ApplicationsResponse>(
    '/api/applications?page=1&limit=200',
    (url: string) => api.get<ApplicationsResponse>(url),
  );

  const apps = React.useMemo(
    () => (data?.applications ?? []).filter((a) => a.job && INTERN_TYPES.has(a.job.employmentType)),
    [data],
  );

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col min-h-full">
      <div className="mb-5">
        <p className="text-sm text-muted-foreground">
          Internship applications you've submitted. Track status and outcome.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && apps.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <Send className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No internship applications yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Apply to internships from the Browse tab — they'll show up here.
          </p>
        </div>
      )}

      {!isLoading && apps.length > 0 && (
        <div className="space-y-2">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/applications/${app.id}`}
              className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                {app.job?.company.slice(0, 2).toUpperCase() ?? '??'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{app.job?.title ?? 'Unknown role'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {app.job?.company} · {app.job?.location}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={STATUS_VARIANT[app.status] ?? 'secondary'}>
                  {formatStatus(app.status)}
                </Badge>
                {app.appliedAt && (
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(app.appliedAt)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
