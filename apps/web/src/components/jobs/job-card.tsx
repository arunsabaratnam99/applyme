'use client';

import React from 'react';
import { MapPin, Building2, Clock, Star, Bookmark } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { CompanyLogo } from './company-logo';
import { ApplyButton } from './apply-button';
import { EmploymentBadge, WorkplaceBadge, SourceBadge } from './badges';
import type { Job } from './types';

export function JobCard({
  job,
  selected,
  onClick,
  isWatched,
  isSaved,
  onToggleSave,
  resolvedUrls,
}: {
  job: Job;
  selected: boolean;
  onClick: () => void;
  isWatched?: boolean;
  isSaved?: boolean;
  onToggleSave?: (job: Job) => void;
  resolvedUrls?: Map<string, string>;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all cursor-pointer',
        selected
          ? 'border-primary/60 bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/30 hover:bg-accent/20',
      )}
    >
      <CompanyLogo company={job.company} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{job.title}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.company}</span>
              {isWatched && (
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <EmploymentBadge type={job.employmentType} />
            <WorkplaceBadge type={job.workplaceType} />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1 truncate max-w-[160px]">
              <MapPin className="h-3 w-3 shrink-0" />
              {job.location}
            </span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(job.postedAt)}
            </span>
          )}
          <SourceBadge source={job.sourceType} />
          <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {onToggleSave && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSave(job); }}
                title={isSaved ? 'Remove bookmark' : 'Save for later'}
                aria-label={isSaved ? 'Remove bookmark' : 'Save for later'}
                className={cn(
                  'flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors',
                  isSaved
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-background hover:bg-accent',
                )}
              >
                <Bookmark className={cn('h-3 w-3', isSaved && 'fill-current')} />
              </button>
            )}
            <ApplyButton
              job={job}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
              {...(resolvedUrls ? { resolvedUrls } : {})}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
