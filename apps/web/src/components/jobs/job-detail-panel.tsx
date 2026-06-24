'use client';

import React from 'react';
import useSWR from 'swr';
import { MapPin, Clock, X, DollarSign, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CompanyLogo } from './company-logo';
import { ApplyButton } from './apply-button';
import { EmploymentBadge, WorkplaceBadge, SourceBadge } from './badges';
import { extractKeywords, extractSalaryFromText, type ParsedSalary } from './helpers';
import type { Job, SalaryData } from './types';

export function JobDetailPanel({ job, onClose, resolvedUrls }: { job: Job; onClose: () => void; resolvedUrls?: Map<string, string> }) {
  const { data: salary, isLoading: salaryLoading } = useSWR<SalaryData>(
    `/api/jobs/salary?title=${encodeURIComponent(job.title)}&location=${encodeURIComponent(job.location)}&jobId=${job.id}`,
    (url: string) => api.get<SalaryData>(url),
  );

  const needsFetch = !job.descriptionPlain.trim();
  const { data: fetchedDesc, isLoading: descLoading } = useSWR<{ text: string }>(
    needsFetch ? `/api/jobs/description?url=${encodeURIComponent(job.jobUrl)}` : null,
    (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json() as Promise<{ text: string }>),
  );

  const descriptionText = job.descriptionPlain.trim() || fetchedDesc?.text?.trim() || '';

  const descParagraphs = React.useMemo(
    () => descriptionText.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
    [descriptionText],
  );

  const { data: llmKeywordsData } = useSWR<{ keywords: string[] }>(
    descriptionText ? ['keywords-extract', job.id] : null,
    () => fetch('/api/keywords/extract', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: descriptionText.slice(0, 6000) }),
    }).then((r) => r.ok ? r.json() : { keywords: [] }),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const keywords = llmKeywordsData?.keywords?.length
    ? llmKeywordsData.keywords
    : extractKeywords(descriptionText);

  const salaryFromDesc = React.useMemo<ParsedSalary>(() => extractSalaryFromText(descriptionText), [descriptionText]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const salaryDisplay = React.useMemo(() => {
    if (salaryLoading) return null;
    if (salary?.min || salary?.max || salary?.median) {
      const { min, max, median } = salary;
      if (median) return `$${(median / 1000).toFixed(0)}K/yr median`;
      if (min && max) return `$${(min / 1000).toFixed(0)}K – $${(max / 1000).toFixed(0)}K/yr`;
      if (min) return `From $${(min / 1000).toFixed(0)}K/yr`;
      if (max) return `Up to $${(max / 1000).toFixed(0)}K/yr`;
    }
    if (salaryFromDesc.min || salaryFromDesc.max) {
      const { min, max, unit } = salaryFromDesc;
      if (unit === 'hourly') {
        const rawMin = min ? Math.round(min / 2080) : null;
        const rawMax = max ? Math.round(max / 2080) : null;
        if (rawMin && rawMax) return `$${rawMin} – $${rawMax}/hr`;
        if (rawMin) return `$${rawMin}/hr`;
      } else if (unit === 'monthly') {
        const rawMin = min ? Math.round(min / 12) : null;
        const rawMax = max ? Math.round(max / 12) : null;
        if (rawMin && rawMax) return `$${(rawMin / 1000).toFixed(1)}K – $${(rawMax / 1000).toFixed(1)}K/mo`;
        if (rawMin) return `$${(rawMin / 1000).toFixed(1)}K/mo`;
      } else {
        if (min && max) return `$${(min / 1000).toFixed(0)}K – $${(max / 1000).toFixed(0)}K/yr`;
        if (min) return `From $${(min / 1000).toFixed(0)}K/yr`;
        if (max) return `Up to $${(max / 1000).toFixed(0)}K/yr`;
      }
    }
    return null;
  }, [salary, salaryLoading, salaryFromDesc]);

  const salarySource = salary?.source ?? (salaryFromDesc.min || salaryFromDesc.max ? 'job_posting' : null);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-40 w-[480px] bg-background border-l border-border flex flex-col shadow-2xl animate-slide-in-right">
        <div className="flex items-start gap-4 p-5 border-b border-border">
          <CompanyLogo company={job.company} size={52} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base leading-snug">{job.title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <EmploymentBadge type={job.employmentType} />
              <WorkplaceBadge type={job.workplaceType} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 px-5 py-3 border-b border-border text-xs text-muted-foreground bg-muted/30 flex-wrap">
          {job.location && (
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatRelativeTime(job.postedAt)}</span>
          )}
          <SourceBadge source={job.sourceType} {...(job.jobUrl ? { href: job.jobUrl } : {})} />
        </div>

        <div className="px-5 pt-4">
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Estimated Salary</p>
              {salaryLoading ? (
                <div className="h-4 w-28 bg-muted rounded animate-pulse mt-0.5" />
              ) : salaryDisplay ? (
                <p className="text-sm font-semibold text-foreground">{salaryDisplay}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Not disclosed</p>
              )}
              {salarySource === 'linkedin' && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Source: LinkedIn Salary Insights</p>
              )}
              {salarySource === 'job_posting' && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Source: Job posting</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Job Description
            </div>
            {(needsFetch && descLoading) ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn('h-3 bg-muted rounded animate-pulse', i % 3 === 2 ? 'w-3/4' : 'w-full')} />
                ))}
              </div>
            ) : descParagraphs.length > 0 ? (
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                {descParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description available — view the full posting for details.</p>
            )}
          </div>

          {keywords.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Skills & Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-foreground/80 font-medium"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center gap-3 bg-background">
          <ApplyButton job={job} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium hover:bg-accent transition-colors" label="View posting" iconSize="h-4 w-4" {...(resolvedUrls ? { resolvedUrls } : {})} />
        </div>
      </div>
    </>
  );
}
