'use client';

import React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { FileEdit, Building2, Clock, ChevronRight, Zap, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Draft {
  id: string;
  status: string;
  applyMethod: string;
  createdAt: string;
  qaBundle: { atsType?: string; questions?: Array<{ required: boolean; profileValue: string }> } | null;
  job: { id: string; company: string; title: string; location: string } | null;
}

interface DraftsResponse {
  drafts: Draft[];
}

const ATS_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby',
  workday: 'Workday', linkedin: 'LinkedIn', indeed: 'Indeed',
  icims: 'iCIMS', taleo: 'Taleo', unknown: 'Other',
};

function countUnanswered(draft: Draft): number {
  const questions = draft.qaBundle?.questions ?? [];
  return questions.filter((q) => q.required && !q.profileValue?.trim()).length;
}

const SWR_KEY = '/api/drafts?status=needs_review';

export default function DraftsPage() {
  const { data, isLoading } = useSWR<DraftsResponse>(
    SWR_KEY,
    (url: string) => api.get<DraftsResponse>(url),
  );
  const { mutate } = useSWRConfig();

  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());

  const drafts = data?.drafts ?? [];

  async function handleDelete(draftId: string) {
    setDeletingIds((prev) => new Set(prev).add(draftId));
    setConfirmingId(null);

    // Optimistic removal
    await mutate(SWR_KEY, (current: DraftsResponse | undefined) => ({
      drafts: (current?.drafts ?? []).filter((d) => d.id !== draftId),
    }), { revalidate: false });

    try {
      await api.delete(`/api/drafts/${draftId}`);
      toast({ title: 'Draft deleted' });
    } catch {
      // Revert on error
      await mutate(SWR_KEY);
      toast({ title: 'Failed to delete draft', variant: 'destructive' });
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(draftId); return next; });
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
        <p className="text-sm text-muted-foreground mt-1">Applications waiting for your review before submission</p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && drafts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileEdit className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No pending drafts</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use Quick Apply on the <Link href="/jobs" className="underline hover:text-foreground">Jobs</Link> page to create a draft.
          </p>
        </div>
      )}

      {!isLoading && drafts.length > 0 && (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const unanswered = countUnanswered(draft);
            const atsType = draft.qaBundle?.atsType ?? 'unknown';
            const isConfirming = confirmingId === draft.id;
            const isDeleting = deletingIds.has(draft.id);

            return (
              <div
                key={draft.id}
                className={cn(
                  'group flex items-center gap-4 rounded-lg border bg-card px-4 py-3.5 transition-colors',
                  isConfirming
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-border hover:bg-accent/40',
                )}
              >
                {/* Left icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>

                {/* Main content — clicking navigates to draft */}
                <Link
                  href={`/drafts/${draft.id}`}
                  className="flex-1 min-w-0"
                  onClick={(e) => isConfirming ? e.preventDefault() : undefined}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{draft.job?.title ?? 'Unknown role'}</p>
                    {unanswered > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                        {unanswered} required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {draft.job?.company ?? '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(draft.createdAt)}
                    </span>
                  </div>
                </Link>

                {/* Right controls — always in flow, never overlapping */}
                <div className="flex items-center gap-2 shrink-0">
                  {isConfirming ? (
                    <>
                      <span className="text-xs text-destructive font-medium mr-1">Delete?</span>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        disabled={isDeleting}
                        className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60"
                      >
                        {isDeleting ? 'Deleting…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="rounded-md border border-border bg-background p-1 hover:bg-accent transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {ATS_LABELS[atsType] ?? atsType}
                      </Badge>
                      <button
                        onClick={() => setConfirmingId(draft.id)}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Delete draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
