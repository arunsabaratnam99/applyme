'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft, Building2, MapPin, FileText, Lock, Edit3,
  AlertTriangle, CheckCircle2, Loader2, ChevronDown, Lightbulb,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/cn';

interface DraftQuestion {
  fieldKey: string;
  label: string;
  required: boolean;
  inputType: 'text' | 'select' | 'checkbox' | 'file' | 'textarea' | 'email' | 'tel';
  options?: string[];
  profileValue: string;
  isGeneral: boolean;
  isReadOnly: boolean;
  isGuessed?: boolean;
}

interface QaBundle {
  questions: DraftQuestion[];
  atsType: string;
  applyUrl: string;
}

interface Draft {
  id: string;
  status: string;
  coverLetter: string;
  resumeVersionId: string;
  qaBundle: QaBundle;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    employmentType: string;
    applyUrl: string;
  } | null;
  createdAt: string;
}

const ATS_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby',
  workday: 'Workday', linkedin: 'LinkedIn', indeed: 'Indeed',
  icims: 'iCIMS', taleo: 'Taleo', unknown: 'Other',
};

export default function DraftReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: draft, isLoading } = useSWR<Draft>(
    `/api/drafts/${id}`,
    (url: string) => api.get<Draft>(url),
  );

  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [manualApplyUrl, setManualApplyUrl] = React.useState<string | null>(null);
  const [missingFields, setMissingFields] = React.useState<Array<{ fieldKey: string; label: string }>>([]);
  const [showCoverLetter, setShowCoverLetter] = React.useState(false);

  // Seed answers from profileValue once draft loads
  React.useEffect(() => {
    if (!draft) return;
    const init: Record<string, string> = {};
    for (const q of draft.qaBundle?.questions ?? []) {
      if (q.profileValue && !q.isReadOnly) {
        init[q.fieldKey] = q.profileValue;
      }
    }
    setAnswers(init);
  }, [draft]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!draft) {
    return <div className="p-6 text-muted-foreground text-sm">Draft not found.</div>;
  }

  if (draft.status === 'sent') {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-16">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Already Submitted</h2>
        <p className="text-sm text-muted-foreground mb-6">This application has already been sent.</p>
        <Button asChild variant="outline">
          <Link href="/applications">View Applications</Link>
        </Button>
      </div>
    );
  }

  const questions = draft.qaBundle?.questions ?? [];
  const atsType = draft.qaBundle?.atsType ?? 'unknown';

  const readOnlyQuestions = questions.filter((q) => q.isReadOnly);
  const editableQuestions = questions.filter((q) => !q.isReadOnly && q.inputType !== 'file');
  const requiredUnanswered = editableQuestions.filter(
    (q) => q.required && !(answers[q.fieldKey] ?? q.profileValue)?.trim(),
  );

  function setAnswer(fieldKey: string, value: string) {
    setAnswers((prev) => ({ ...prev, [fieldKey]: value }));
    setMissingFields((prev) => prev.filter((f) => f.fieldKey !== fieldKey));
    setSubmitError(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    setMissingFields([]);

    try {
      const result = await api.post<{ success: boolean; applicationId?: string; error?: string; missingFields?: Array<{ fieldKey: string; label: string }> }>(
        `/api/drafts/${id}/submit`,
        { answers },
      );

      if (result.success && result.applicationId) {
        toast({ title: 'Application submitted!', description: `${draft?.job?.title ?? 'Role'} at ${draft?.job?.company ?? 'Company'}` });
        router.push(`/applications/${result.applicationId}`);
      } else {
        setSubmitError(result.error ?? 'Submission failed');
        if (result.missingFields) setMissingFields(result.missingFields);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        const url = err.body?.['applyUrl'];
        if (typeof url === 'string' && url) setManualApplyUrl(url);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto pb-16">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>

        {/* Job header */}
        <div className="rounded-lg border border-border bg-card p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{draft.job?.title ?? 'Unknown role'}</h1>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{draft.job?.company}</span>
                {draft.job?.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{draft.job.location}</span>
                )}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              {ATS_LABELS[atsType] ?? atsType}
            </Badge>
          </div>

          {requiredUnanswered.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{requiredUnanswered.length} required field{requiredUnanswered.length > 1 ? 's' : ''} need your answer before submitting.</span>
            </div>
          )}
        </div>

        {/* Cover letter */}
        {draft.coverLetter && (
          <div className="rounded-lg border border-border bg-card p-5 mb-4">
            <button
              type="button"
              onClick={() => setShowCoverLetter((v) => !v)}
              className="flex items-center gap-2 w-full text-left text-sm font-semibold"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              Cover Letter
              <ChevronDown className={cn('h-4 w-4 ml-auto text-muted-foreground transition-transform', showCoverLetter && 'rotate-180')} />
            </button>
            {showCoverLetter && (
              <div className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-md px-3 py-2.5 max-h-56 overflow-y-auto">
                {draft.coverLetter}
              </div>
            )}
          </div>
        )}

        {/* Auto-filled fields (read-only) */}
        {readOnlyQuestions.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Auto-filled from your profile</h2>
              <span className="text-xs text-muted-foreground ml-auto">Edit in Settings → Profile</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {readOnlyQuestions.map((q) => (
                <div key={q.fieldKey}>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    {q.label}{q.required && <span className="text-destructive ml-0.5">*</span>}
                  </p>
                  <p className="text-xs text-foreground truncate">
                    {q.inputType === 'file' ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Attached
                      </span>
                    ) : (
                      q.profileValue || <span className="text-muted-foreground/50 italic">—</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable fields */}
        {editableQuestions.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Complete your application</h2>
            </div>
            <div className="space-y-4">
              {editableQuestions.map((q) => {
                const val = answers[q.fieldKey] ?? q.profileValue ?? '';
                const isMissing = missingFields.some((f) => f.fieldKey === q.fieldKey);
                const isRequiredEmpty = q.required && !val.trim();

                return (
                  <div key={q.fieldKey}>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      {q.label}
                      {q.required && <span className="text-destructive ml-0.5">*</span>}
                      {q.isGuessed && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-normal">
                          <Lightbulb className="h-3 w-3" />Guessed — please verify
                        </span>
                      )}
                      {q.isGeneral && !q.isGuessed && (
                        <span className="ml-2 text-[10px] text-muted-foreground font-normal">(saved to profile)</span>
                      )}
                    </label>

                    {q.inputType === 'select' && q.options ? (
                      <div className="relative">
                        <select
                          value={val}
                          onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                          className={cn(
                            'w-full rounded-lg border bg-background px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                            isMissing || isRequiredEmpty ? 'border-destructive/60' : 'border-input',
                          )}
                        >
                          <option value="">-- Select --</option>
                          {q.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    ) : q.inputType === 'checkbox' && q.options ? (
                      <div className={cn(
                        'rounded-lg border p-3 space-y-2',
                        isMissing || isRequiredEmpty ? 'border-destructive/60' : 'border-input',
                      )}>
                        {q.options.map((opt) => {
                          const selected = val.split(',').map((v) => v.trim()).filter(Boolean);
                          const checked = selected.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2.5 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const cur = val.split(',').map((v) => v.trim()).filter(Boolean);
                                  const next = e.target.checked
                                    ? [...cur, opt]
                                    : cur.filter((v) => v !== opt);
                                  setAnswer(q.fieldKey, next.join(', '));
                                }}
                                className="h-4 w-4 rounded border-input"
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    ) : q.inputType === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={val}
                        onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                        placeholder={`Enter ${q.label.toLowerCase()}…`}
                        className={cn(
                          'w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                          isMissing || isRequiredEmpty ? 'border-destructive/60' : 'border-input',
                        )}
                      />
                    ) : (
                      <input
                        type={q.inputType === 'email' ? 'email' : q.inputType === 'tel' ? 'tel' : 'text'}
                        value={val}
                        onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                        placeholder={`Enter ${q.label.toLowerCase()}…`}
                        className={cn(
                          'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                          isMissing || isRequiredEmpty ? 'border-destructive/60' : 'border-input',
                        )}
                      />
                    )}

                    {(isMissing || isRequiredEmpty) && (
                      <p className="text-[11px] text-destructive mt-1">This field is required.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {submitError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{submitError}</span>
              {manualApplyUrl && (
                <div className="mt-2">
                  <a
                    href={manualApplyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive underline underline-offset-2 hover:opacity-80"
                  >
                    Apply manually on the company site →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Submitting to <span className="font-medium">{draft.job?.company}</span> via {ATS_LABELS[atsType] ?? atsType}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={submitting || requiredUnanswered.length > 0}
            className="gap-2 min-w-36"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
