'use client';

import React from 'react';
import useSWR from 'swr';
import { Bookmark } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { JobCard, JobDetailPanel, type Job } from '@/components/jobs';

interface SavedJobsResponse {
  items: Array<{ id: string; jobId: string; createdAt: string; job: Job }>;
}

export function SavedView() {
  const { data, isLoading, mutate } = useSWR<SavedJobsResponse>(
    '/api/saved-jobs',
    (url: string) => api.get<SavedJobsResponse>(url),
  );

  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const resolvedUrlCache = React.useRef<Map<string, string>>(new Map());

  async function toggleSave(job: Job) {
    await mutate(
      (prev) => prev ? { items: prev.items.filter((i) => i.jobId !== job.id) } : prev,
      { revalidate: false },
    );
    try {
      await api.delete(`/api/saved-jobs/${job.id}`);
    } finally {
      mutate();
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('flex-1 flex flex-col min-h-0 transition-all duration-300', selectedJob ? 'mr-[480px]' : '')}>
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-3xl mx-auto flex flex-col min-h-full">
            <div className="mb-5">
              <p className="text-sm text-muted-foreground">
                Internships you've bookmarked. Click any to view and apply.
              </p>
            </div>

            {isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-[76px] rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && items.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <Bookmark className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No saved internships yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Bookmark internships from the Browse tab to save them here.
                </p>
              </div>
            )}

            {!isLoading && items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <JobCard
                    key={item.id}
                    job={item.job}
                    selected={selectedJob?.id === item.job.id}
                    onClick={() => setSelectedJob(selectedJob?.id === item.job.id ? null : item.job)}
                    isSaved
                    onToggleSave={toggleSave}
                    resolvedUrls={resolvedUrlCache.current}
                  />
                ))}
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
