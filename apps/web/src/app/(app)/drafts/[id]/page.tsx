'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft, Building2, MapPin, FileText, Lock, Edit3,
  AlertTriangle, CheckCircle2, Loader2, ChevronDown, Lightbulb,
  ExternalLink,
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
  const [submitted, setSubmitted] = React.useState(false);

  // Seed answers from profileValue once draft loads (editable fields only)
  React.useEffect(() => {
    if (!draft) return;
    const init: Record<string, string> = {};
    for (const q of draft.qaBundle?.questions ?? []) {
      if (!q.isReadOnly && q.inputType !== 'file') {
        init[q.fieldKey] = q.profileValue ?? '';
      }
    }
    setAnswers(init);
  }, [draft]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!draft) {
    return <div className="p-6 text-muted-foreground text-sm">Draft not found.</div>;
  }

  if (draft.status === 'sent' || submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-5">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Application Submitted</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your application to <span className="font-medium text-foreground">{draft.job?.company}</span> has been sent.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/jobs">Back to Jobs</Link>
          </Button>
          <Button asChild>
            <Link href="/applications">View Applications</Link>
          </Button>
        </div>
      </div>
    );
  }

  const questions = draft.qaBundle?.questions ?? [];
  const atsType = draft.qaBundle?.atsType ?? 'unknown';

  const readOnlyQuestions = questions.filter((q) => q.isReadOnly);
  const editableQuestions = questions.filter((q) => !q.isReadOnly && q.inputType !== 'file');

  // Required editable fields that are currently empty
  const requiredUnanswered = editableQuestions.filter(
    (q) => q.required && !(answers[q.fieldKey] ?? '').trim(),
  );

  // Fields the user should pay attention to: empty optional general fields + guessed + required empty
  const needsAttention = editableQuestions.filter((q) => {
    const val = (answers[q.fieldKey] ?? '').trim();
    return q.isGuessed || (q.required && !val) || (!val && q.isGeneral);
  });

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
        toast({
          title: 'Application submitted!',
          description: `${draft?.job?.title ?? 'Role'} at ${draft?.job?.company ?? 'Company'}`,
        });
        setSubmitted(true);
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
      <div className="p-6 max-w-2xl mx-auto pb-16">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>

        {/* Job header */}
        <div className="rounded-xl border border-border bg-card p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold leading-snug">{draft.job?.title ?? 'Unknown role'}</h1>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0" />{draft.job?.company}</span>
                {draft.job?.location && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" />{draft.job.location}</span>
                )}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs font-medium">
              {ATS_LABELS[atsType] ?? atsType}
            </Badge>
          </div>

          {requiredUnanswered.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {requiredUnanswered.length} required field{requiredUnanswered.length > 1 ? 's' : ''} still need{requiredUnanswered.length === 1 ? 's' : ''} your input.
              </span>
            </div>
          )}
        </div>

        {/* Cover letter (collapsible) */}
        {draft.coverLetter && (
          <div className="rounded-xl border border-border bg-card p-5 mb-4">
            <button
              type="button"
              onClick={() => setShowCoverLetter((v) => !v)}
              className="flex items-center gap-2 w-full text-left text-sm font-semibold"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              Cover Letter
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">AI-generated</span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showCoverLetter && 'rotate-180')} />
            </button>
            {showCoverLetter && (
              <div className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg px-3 py-2.5 max-h-56 overflow-y-auto">
                {draft.coverLetter}
              </div>
            )}
          </div>
        )}

        {/* Auto-filled fields (read-only) */}
        {readOnlyQuestions.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Auto-filled from your profile</h2>
              <Link
                href="/settings?tab=profile"
                className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                Edit in Settings
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {readOnlyQuestions.map((q) => (
                <div key={q.fieldKey}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {q.label}{q.required && <span className="text-destructive ml-0.5">*</span>}
                  </p>
                  <p className="text-sm text-foreground truncate">
                    {q.inputType === 'file' ? (
                      <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Attached
                      </span>
                    ) : (
                      q.profileValue || <span className="text-muted-foreground/50 italic text-xs">—</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable fields — only render if there are any */}
        {editableQuestions.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Edit3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Complete your application</h2>
            </div>
            {needsAttention.length > 0 && (
              <p className="text-xs text-muted-foreground mb-4 ml-6">
                {needsAttention.length} field{needsAttention.length > 1 ? 's' : ''} need{needsAttention.length === 1 ? 's' : ''} your attention — these will be saved to your profile for future applications.
              </p>
            )}
            <div className="space-y-4 mt-4">
              {editableQuestions.map((q) => {
                const val = answers[q.fieldKey] ?? '';
                const isMissing = missingFields.some((f) => f.fieldKey === q.fieldKey);
                const isRequiredEmpty = q.required && !val.trim();
                const showError = isMissing || isRequiredEmpty;

                return (
                  <div key={q.fieldKey}>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      {q.label}
                      {q.required && <span className="text-destructive ml-0.5">*</span>}
                      {q.isGuessed && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-normal ml-1.5 whitespace-nowrap align-middle">
                          <Lightbulb className="h-3 w-3" />Guessed — verify
                        </span>
                      )}
                      {q.isGeneral && !q.isGuessed && (
                        <span className="text-[10px] text-muted-foreground font-normal ml-1.5 whitespace-nowrap align-middle">(saved to profile)</span>
                      )}
                    </label>

                    {q.inputType === 'select' && q.options ? (
                      <div className="relative">
                        <select
                          value={val}
                          onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                          className={cn(
                            'w-full rounded-lg border bg-background px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-colors',
                            showError ? 'border-destructive/60 bg-destructive/5' : 'border-input',
                          )}
                        >
                          <option value="">— Select —</option>
                          {q.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    ) : q.inputType === 'checkbox' && q.options ? (
                      <div className={cn(
                        'rounded-lg border p-3 space-y-2',
                        showError ? 'border-destructive/60 bg-destructive/5' : 'border-input',
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
                          'w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-colors',
                          showError ? 'border-destructive/60 bg-destructive/5' : 'border-input',
                        )}
                      />
                    ) : (
                      <input
                        type={q.inputType === 'email' ? 'email' : q.inputType === 'tel' ? 'tel' : 'text'}
                        value={val}
                        onChange={(e) => setAnswer(q.fieldKey, e.target.value)}
                        placeholder={
                          q.fieldKey === 'linkedin_url' ? 'https://linkedin.com/in/yourname' :
                          q.fieldKey === 'github_url' ? 'https://github.com/yourname' :
                          q.fieldKey === 'website_url' ? 'https://yoursite.com' :
                          `Enter ${q.label.toLowerCase()}…`
                        }
                        className={cn(
                          'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-colors',
                          showError ? 'border-destructive/60 bg-destructive/5' : 'border-input',
                        )}
                      />
                    )}

                    {showError && (
                      <p className="text-[11px] text-destructive mt-1">This field is required.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error banner */}
        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4 flex items-start gap-2 text-sm text-destructive">
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
                    Apply manually on the company site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Submitting to <span className="font-medium text-foreground">{draft.job?.company}</span> via {ATS_LABELS[atsType] ?? atsType}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={submitting || requiredUnanswered.length > 0}
            className="gap-2 min-w-40"
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
