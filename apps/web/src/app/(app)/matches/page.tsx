'use client';

import React from 'react';
import useSWR, { mutate } from 'swr';
import { Zap, MapPin, Building2, Clock, ExternalLink, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatRelativeTime } from '@/lib/format';

interface JobMatch {
  id: string;
  score: number;
  reasons: string[];
  dismissed: boolean;
  createdAt: string;
  job: {
    id: string;
    company: string;
    title: string;
    location: string;
    workplaceType: string | null;
    employmentType: string;
    applyUrl: string;
    postedAt: string | null;
  } | null;
}

interface MatchesResponse {
  matches: JobMatch[];
  page: number;
  limit: number;
}

const KEY = '/api/matches?page=1&limit=50';

export default function MatchesPage() {
  const { data, isLoading } = useSWR<MatchesResponse>(KEY, (url: string) => api.get<MatchesResponse>(url));

  async function handleDismiss(matchId: string) {
    try {
      await api.post(`/api/matches/${matchId}/dismiss`);
      await mutate(KEY);
    } catch {
      toast({ title: 'Failed to dismiss', variant: 'destructive' });
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Matches
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Jobs matched to your profile and watchlist, scored by relevance</p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && data.matches.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Zap className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>No matches yet. Complete your profile and add companies to your watchlist.</p>
        </div>
      )}

      {data && (
        <div className="space-y-2">
          {data.matches.map((match) => (
            <MatchCard key={match.id} match={match} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = pct >= 75 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{score}</span>
    </div>
  );
}

function MatchCard({ match, onDismiss }: { match: JobMatch; onDismiss: (id: string) => void }) {
  const job = match.job;
  if (!job) return null;
  return (
    <div className="group rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
          {job.company.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-sm">{job.title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3" />{job.company}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ScoreBar score={match.score} />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                onClick={() => onDismiss(match.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
            {job.workplaceType && <Badge variant="outline" className="text-[10px] py-0">{job.workplaceType}</Badge>}
            {job.postedAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatRelativeTime(job.postedAt)}</span>}
          </div>

          {match.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {match.reasons.slice(0, 4).map((r) => (
                <span key={r} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary font-medium">{r}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" asChild>
              <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />View posting
              </a>
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5">
              <Zap className="h-3 w-3" />Quick Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
