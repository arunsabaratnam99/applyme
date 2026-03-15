'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { FileEdit, Building2, Clock, ChevronRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
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

export default function DraftsPage() {
  const { data, isLoading } = useSWR<DraftsResponse>(
    '/api/drafts?status=needs_review',
    (url: string) => api.get<DraftsResponse>(url),
  );

  const drafts = data?.drafts ?? [];

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
            return (
              <Link
                key={draft.id}
                href={`/drafts/${draft.id}`}
                className="group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3.5 hover:bg-accent/40 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
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
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {ATS_LABELS[atsType] ?? atsType}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
