'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatRelativeTime, formatStatus } from '@/lib/format';

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


const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'muted'> = {
  applied: 'default',
  interviewing: 'warning',
  offer: 'success',
  rejected: 'destructive',
  withdrawn: 'muted',
};

export default function ApplicationsPage() {
  const [page, setPage] = React.useState(1);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const { data, isLoading, mutate } = useSWR<ApplicationsResponse>(
    `/api/applications?page=${page}&limit=25`,
    (url: string) => api.get<ApplicationsResponse>(url),
  );

  async function handleDelete(e: React.MouseEvent, appId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Remove this application from your history?')) return;
    setDeletingId(appId);
    try {
      await api.delete(`/api/applications/${appId}`);
      await mutate(
        (prev) => prev ? { ...prev, applications: prev.applications.filter((a) => a.id !== appId) } : prev,
        { revalidate: false },
      );
      toast({ title: 'Application removed' });
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

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
            <div key={app.id} className="group flex items-center gap-2 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-accent/30 transition-colors animate-fade-in">
              <Link
                href={`/applications/${app.id}`}
                className="flex flex-1 items-center gap-4 p-4 min-w-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  {app.job?.company.slice(0, 2).toUpperCase() ?? '??'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{app.job?.title ?? 'Unknown role'}</p>
                  <p className="text-xs text-muted-foreground truncate">{app.job?.company} · {app.job?.location}</p>
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
              <button
                onClick={(e) => handleDelete(e, app.id)}
                disabled={deletingId === app.id}
                className="mr-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground disabled:opacity-30"
                title="Remove application"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
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
