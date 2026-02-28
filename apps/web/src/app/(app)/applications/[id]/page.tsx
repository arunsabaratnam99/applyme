'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MapPin, Building2, Clock, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDate, formatStatus, formatApplyMethod } from '@/lib/format';

interface TimelineEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface Application {
  id: string;
  status: string;
  applyMethod: string;
  appliedAt: string | null;
  notes: string | null;
  submittedData: Record<string, unknown>;
  timeline: TimelineEvent[];
  job: {
    id: string;
    company: string;
    title: string;
    location: string;
    workplaceType: string | null;
    jobUrl: string;
    applyUrl: string;
    employmentType: string;
  } | null;
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: app, isLoading } = useSWR<Application>(
    `/api/applications/${id}`,
    (url: string) => api.get<Application>(url),
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
        <div className="h-60 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!app) return <div className="p-6 text-muted-foreground text-sm">Application not found.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/applications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Applications
      </Link>

      <div className="rounded-lg border border-border bg-card p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{app.job?.title ?? 'Unknown role'}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{app.job?.company}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{app.job?.location}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formatStatus(app.status)}</Badge>
            {app.job?.applyUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={app.job.applyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View posting
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Method</p>
            <p className="font-medium">{formatApplyMethod(app.applyMethod)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Applied</p>
            <p className="font-medium">{app.appliedAt ? formatDate(app.appliedAt) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Employment</p>
            <p className="font-medium">{formatStatus(app.job?.employmentType ?? '')}</p>
          </div>
        </div>

        {app.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{app.notes}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Timeline
        </h2>
        {app.timeline.length === 0 && (
          <p className="text-sm text-muted-foreground">No timeline events yet.</p>
        )}
        <div className="relative">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {app.timeline.map((event) => (
              <div key={event.id} className="flex items-start gap-4 pl-6 relative">
                <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary border-2 border-background" />
                <div>
                  <p className="text-sm font-medium">{formatStatus(event.eventType)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
