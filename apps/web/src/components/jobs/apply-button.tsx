'use client';

import React from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Job } from './types';

export function ApplyButton({ job, className, label = 'Apply', iconSize = 'h-3 w-3', resolvedUrls }: {
  job: Job;
  className?: string;
  label?: string;
  iconSize?: string;
  resolvedUrls?: Map<string, string>;
}) {
  const [resolving, setResolving] = React.useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (!/linkedin\.com/i.test(job.applyUrl)) {
      window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const cached = resolvedUrls?.get(job.id);
    if (cached) {
      window.open(cached, '_blank', 'noopener,noreferrer');
      return;
    }

    const win = window.open('', '_blank', 'noopener,noreferrer');

    setResolving(true);
    try {
      const result = await api.get<{ applyUrl: string }>(`/api/jobs/${job.id}/resolve-apply-url`);
      const resolvedUrl = result.applyUrl ?? job.applyUrl;
      resolvedUrls?.set(job.id, resolvedUrl);
      if (win) win.location.href = resolvedUrl;
      else window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      if (win) win.location.href = job.applyUrl;
      else window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setResolving(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={resolving} className={className}>
      {resolving ? <Loader2 className={`${iconSize} animate-spin`} /> : <ExternalLink className={iconSize} />}
      {label}
    </button>
  );
}
