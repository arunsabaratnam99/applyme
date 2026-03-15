'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, MapPin, Building2, Clock, ExternalLink, FileText, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showFields, setShowFields] = React.useState(false);

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
            {(() => {
              const submittedApplyUrl = typeof app.submittedData?.['applyUrl'] === 'string' ? app.submittedData['applyUrl'] : null;
              const viewUrl = submittedApplyUrl || app.job?.jobUrl || app.job?.applyUrl;
              return viewUrl ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View posting
                  </a>
                </Button>
              ) : null;
            })()}
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

      {/* Submitted Data */}
      {app.submittedData && Object.keys(app.submittedData).length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 mb-4">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            What Was Submitted
          </h2>

          {/* Resume version — label only, no download */}
          {app.submittedData['resumeVersionLabel'] != null && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Resume Version</p>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {`${app.submittedData['resumeVersionLabel']}`}
              </span>
            </div>
          )}

          {/* Cover letter */}
          {app.submittedData['coverLetter'] != null && `${app.submittedData['coverLetter']}`.trim() && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Cover Letter</p>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {`${app.submittedData['coverLetter']}`}
              </div>
            </div>
          )}

          {/* Field values */}
          {app.submittedData['fieldValues'] != null && (
            <div>
              <button
                type="button"
                onClick={() => setShowFields((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {showFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showFields ? 'Hide' : 'Show'} form fields ({Object.keys(app.submittedData['fieldValues'] as Record<string, unknown>).length})
              </button>
              {showFields && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {Object.entries(app.submittedData['fieldValues'] as Record<string, unknown>)
                    .filter(([, v]) => v != null && `${v}`.trim())
                    .map(([key, value]) => (
                      <div key={key} className="space-y-0.5">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-foreground truncate">{`${value}`}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
