'use client';

import React from 'react';
import useSWR from 'swr';
import { ClipboardList, CheckCircle2, XCircle, Clock, Loader2, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';

interface QueueJob {
  id: string;
  company: string;
  title: string;
  applyUrl: string;
}

interface QueueItem {
  id: string;
  userId: string;
  jobId: string;
  draftId: string;
  applyUrl: string;
  atsType: string;
  status: string;
  errorDetail: string | null;
  attemptCount: number;
  attemptedAt: string | null;
  createdAt: string;
  expiresAt: string;
  job: QueueJob | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3.5 w-3.5" />,
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  completed: {
    label: 'Submitted',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  expired: {
    label: 'Expired',
    icon: <Clock className="h-3.5 w-3.5" />,
    className: 'text-muted-foreground bg-muted border-border',
  },
  opened: {
    label: 'In Progress',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    className: 'text-primary bg-primary/10 border-primary/20',
  },
};

const ATS_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  icims: 'iCIMS',
  taleo: 'Taleo',
  unknown: 'Other',
};

const QUEUE_KEY = '/api/autofill-queue';

export default function ApplyQueuePage() {
  const { data, isLoading, mutate } = useSWR<QueueItem[]>(
    QUEUE_KEY,
    (url: string) => api.get<QueueItem[]>(url),
    { refreshInterval: 10000 },
  );

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/autofill-queue/${id}`);
      await mutate();
      toast({ title: 'Removed from queue' });
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    }
  }

  const items = data ?? [];
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'opened');
  const done = items.filter((i) => i.status === 'completed' || i.status === 'failed' || i.status === 'expired');

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto pb-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Application Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Applications being processed automatically in the background.
            </p>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Queue is empty</p>
            <p className="text-xs mt-1">Use Quick Apply on a job to queue an application.</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              In Progress ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map((item) => (
                <QueueCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Completed ({done.length})
            </h2>
            <div className="space-y-2">
              {done.map((item) => (
                <QueueCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueCard({ item, onDelete }: { item: QueueItem; onDelete: (id: string) => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['pending']!;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-sm truncate">
            {item.job?.title ?? 'Unknown Role'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {item.job?.company ?? '—'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status badge */}
          <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium', cfg.className)}>
            {cfg.icon}
            {cfg.label}
          </span>

          {/* ATS badge */}
          <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {ATS_LABELS[item.atsType] ?? item.atsType}
          </span>

          {/* Attempt count */}
          {item.attemptCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {item.attemptCount} attempt{item.attemptCount !== 1 ? 's' : ''}
            </span>
          )}

          {/* Timestamp */}
          <span className="text-[11px] text-muted-foreground ml-auto">
            {formatRelativeTime(item.createdAt)}
          </span>
        </div>

        {/* Error detail */}
        {item.errorDetail && (
          <p className="mt-1.5 text-xs text-destructive/80 font-mono bg-destructive/5 rounded px-2 py-1 truncate">
            {item.errorDetail}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {item.job?.applyUrl && (
          <a
            href={item.job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Open job"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Remove from queue"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
