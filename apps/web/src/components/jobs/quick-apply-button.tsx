'use client';

import React from 'react';
import { Zap, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { Job } from './types';

type QuickApplyState = 'idle' | 'loading' | 'queued' | 'error';

export function QuickApplyButton({ job, className, iconSize = 'h-3 w-3', resolvedUrls }: {
  job: Job;
  className?: string;
  iconSize?: string;
  resolvedUrls?: Map<string, string>;
}) {
  const [state, setState] = React.useState<QuickApplyState>('idle');

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (state === 'loading' || state === 'queued') return;

    setState('loading');
    try {
      const result = await api.post<{ id: string; applyUrl: string }>('/api/quick-apply', { jobId: job.id });
      const applyUrl = result.applyUrl ?? job.applyUrl;

      // Resolve LinkedIn URLs the same way ApplyButton does
      if (/linkedin\.com/i.test(applyUrl)) {
        const cached = resolvedUrls?.get(job.id);
        const finalUrl = cached ?? (() => {
          api.get<{ applyUrl: string }>(`/api/jobs/${job.id}/resolve-apply-url`)
            .then((r) => { resolvedUrls?.set(job.id, r.applyUrl ?? applyUrl); })
            .catch(() => { /* silent */ });
          return applyUrl;
        })();
        window.open(finalUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.open(applyUrl, '_blank', 'noopener,noreferrer');
      }

      setState('queued');
      setTimeout(() => setState('idle'), 4000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const icon = state === 'loading'
    ? <Loader2 className={`${iconSize} animate-spin`} />
    : state === 'queued'
      ? <Check className={iconSize} />
      : <Zap className={iconSize} />;

  const label = state === 'loading' ? 'Queuing…' : state === 'queued' ? 'Queued' : state === 'error' ? 'Failed' : 'Quick Apply';

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      title="Quick Apply — opens the job and auto-fills the form via the ApplyMe extension"
      className={className}
    >
      {icon}
      {label}
    </button>
  );
}
