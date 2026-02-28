'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Send, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRelativeTime, formatStatus, formatApplyMethod } from '@/lib/format';

interface Application {
  id: string;
  status: string;
  applyMethod: string;
  appliedAt: string | null;
  job: { id: string; company: string; title: string; location: string } | null;
}

interface ApplicationsResponse {
  applications: Application[];
  page: number;
  limit: number;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  applied: <Send className="h-3.5 w-3.5 text-primary" />,
  interviewing: <Clock className="h-3.5 w-3.5 text-warning" />,
  offer: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  withdrawn: <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />,
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'muted'> = {
  applied: 'default',
  interviewing: 'warning',
  offer: 'success',
  rejected: 'destructive',
  withdrawn: 'muted',
};

export default function ApplicationsPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useSWR<ApplicationsResponse>(
    `/api/applications?page=${page}&limit=25`,
    (url: string) => api.get<ApplicationsResponse>(url),
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground mt-1">Track every application you've sent</p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-2">
          {data.applications.length === 0 && (
            <p className="text-center text-muted-foreground py-16 text-sm">No applications yet. Start applying from the Jobs or Matches pages.</p>
          )}
          {data.applications.map((app) => (
            <Link
              key={app.id}
              href={`/applications/${app.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-colors animate-fade-in"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                {app.job?.company.slice(0, 2).toUpperCase() ?? '??'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{app.job?.title ?? 'Unknown role'}</p>
                <p className="text-xs text-muted-foreground truncate">{app.job?.company} · {app.job?.location}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={STATUS_VARIANT[app.status] ?? 'secondary'} className="flex items-center gap-1">
                  {STATUS_ICON[app.status]}
                  {formatStatus(app.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatApplyMethod(app.applyMethod)}</span>
                {app.appliedAt && (
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(app.appliedAt)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.applications.length >= 25 && (
        <div className="flex justify-center mt-6 gap-2">
          <button
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
