'use client';

import React from 'react';
import useSWR, { mutate } from 'swr';
import { Layers, CheckCircle2, SkipForward, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/lib/format';

interface QueueItem {
  id: string;
  jobId: string;
  applyUrl: string;
  atsType: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  job: { company: string; title: string; location: string } | null;
}

const KEY = '/api/autofill-queue';

export default function QueuePage() {
  const { data, isLoading } = useSWR<QueueItem[]>(KEY, (url: string) => api.get<QueueItem[]>(url));

  async function handleComplete(id: string) {
    try {
      await api.post(`/api/autofill-queue/${id}/complete`);
      await mutate(KEY);
      toast({ title: 'Application marked as complete' });
    } catch {
      toast({ title: 'Failed to complete', variant: 'destructive' });
    }
  }

  async function handleSkip(id: string) {
    try {
      await api.post(`/api/autofill-queue/${id}/skip`);
      await mutate(KEY);
      toast({ title: 'Skipped' });
    } catch {
      toast({ title: 'Failed to skip', variant: 'destructive' });
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Autofill Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Applications waiting for the browser extension to autofill. Open each link and let the extension fill the form.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Layers className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>Your autofill queue is empty.</p>
          <p className="mt-1">Apply to jobs to populate the queue.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((item) => {
            const expiresAt = new Date(item.expiresAt);
            const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / 3_600_000);
            const isExpiringSoon = hoursLeft < 12;

            return (
              <div key={item.id} className="rounded-lg border border-border bg-card p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                    {item.job?.company.slice(0, 2).toUpperCase() ?? '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{item.job?.title ?? 'Unknown role'}</p>
                        <p className="text-xs text-muted-foreground">{item.job?.company} · {item.job?.location}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.atsType !== 'unknown' && (
                          <Badge variant="outline" className="text-[10px]">{item.atsType}</Badge>
                        )}
                        {isExpiringSoon && (
                          <Badge variant="warning" className="text-[10px] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {hoursLeft}h left
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" asChild>
                        <a href={item.applyUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          Open & Autofill
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => handleComplete(item.id)}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Mark sent
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 text-xs text-muted-foreground"
                        onClick={() => handleSkip(item.id)}
                      >
                        <SkipForward className="h-3 w-3" />
                        Skip
                      </Button>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Added {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
