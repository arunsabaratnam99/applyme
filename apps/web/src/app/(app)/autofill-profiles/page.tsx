'use client';

import React from 'react';
import useSWR from 'swr';
import {
  Layers, Save, ChevronDown, ChevronUp, Info, Zap,
  Plus, Trash2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/cn';

interface SettingsFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  visaAuth: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
}

interface UnknownField {
  fieldKey: string;
  label: string;
  userValue: string;
}

interface AutofillProfile {
  atsType: string;
  enabled: boolean;
  fieldOverrides: Record<string, string>;
  unknownFields: UnknownField[];
  settingsFields: SettingsFields;
  updatedAt: string | null;
}

const PROFILES_KEY = '/api/autofill-profiles';

const ATS_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  icims: 'iCIMS',
  taleo: 'Taleo',
  unknown: 'Other / Unknown',
};

const ATS_COLORS: Record<string, string> = {
  greenhouse: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  lever: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  ashby: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  workday: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  linkedin: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  indeed: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  icims: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  taleo: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  unknown: 'bg-muted text-muted-foreground border-border',
};

export default function AutofillProfilesPage() {
  const { data, isLoading, mutate } = useSWR<AutofillProfile[]>(
    PROFILES_KEY,
    (url: string) => api.get<AutofillProfile[]>(url),
  );

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = React.useState<Record<string, AutofillProfile>>({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [newOverrideKey, setNewOverrideKey] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!data) return;
    const init: Record<string, AutofillProfile> = {};
    for (const p of data) init[p.atsType] = { ...p, fieldOverrides: { ...p.fieldOverrides }, unknownFields: p.unknownFields.map((f) => ({ ...f })) };
    setDrafts(init);
  }, [data]);

  function toggleExpand(atsType: string) {
    setExpanded((prev) => ({ ...prev, [atsType]: !prev[atsType] }));
  }

  function updateDraft(atsType: string, patch: Partial<AutofillProfile>) {
    setDrafts((prev) => ({ ...prev, [atsType]: { ...prev[atsType]!, ...patch } }));
  }

  async function handleSave(atsType: string) {
    const draft = drafts[atsType];
    if (!draft) return;
    setSaving((prev) => ({ ...prev, [atsType]: true }));
    try {
      await api.put(`/api/autofill-profiles/${atsType}`, {
        enabled: draft.enabled,
        fieldOverrides: draft.fieldOverrides,
        unknownFields: draft.unknownFields,
      });
      await mutate();
      toast({ title: `${ATS_LABELS[atsType] ?? atsType} profile saved` });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving((prev) => ({ ...prev, [atsType]: false }));
    }
  }

  function addOverride(atsType: string) {
    const key = (newOverrideKey[atsType] ?? '').trim();
    if (!key) return;
    const draft = drafts[atsType];
    if (!draft) return;
    updateDraft(atsType, { fieldOverrides: { ...draft.fieldOverrides, [key]: '' } });
    setNewOverrideKey((prev) => ({ ...prev, [atsType]: '' }));
  }

  function removeOverride(atsType: string, key: string) {
    const draft = drafts[atsType];
    if (!draft) return;
    const next = { ...draft.fieldOverrides };
    delete next[key];
    updateDraft(atsType, { fieldOverrides: next });
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const profiles = data ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto pb-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Autofill Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure what the extension fills in for each job board. Global info (name, visa, phone, etc.) is managed in{' '}
            <a href="/settings" className="text-primary underline-offset-2 hover:underline">Settings → Profile</a>.
          </p>
        </div>

        <div className="space-y-3">
          {profiles.map((profile) => {
            const draft = drafts[profile.atsType];
            if (!draft) return null;
            const isExpanded = expanded[profile.atsType] ?? false;
            const isSaving = saving[profile.atsType] ?? false;
            const hasUnanswered = draft.unknownFields.some((f) => !f.userValue);

            return (
              <div
                key={profile.atsType}
                className={cn(
                  'rounded-xl border transition-colors',
                  draft.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/30',
                )}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 p-4">
                  <span className={cn('inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold', ATS_COLORS[profile.atsType] ?? ATS_COLORS['unknown'])}>
                    {ATS_LABELS[profile.atsType] ?? profile.atsType}
                  </span>

                  {hasUnanswered && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {draft.unknownFields.filter((f) => !f.userValue).length} unanswered
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.enabled}
                      onClick={() => updateDraft(profile.atsType, { enabled: !draft.enabled })}
                      title={draft.enabled ? 'Disable Quick Apply for this ATS' : 'Enable Quick Apply for this ATS'}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none',
                        draft.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
                      )}
                    >
                      <span className={cn(
                        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                        draft.enabled ? 'translate-x-4' : 'translate-x-0.5',
                      )} />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpand(profile.atsType)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-5 border-t border-border pt-4">

                    {/* From Settings — read-only */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From Settings</p>
                        <Info className="h-3 w-3 text-muted-foreground/60" />
                        <span className="text-[10px] text-muted-foreground">Edit in Settings → Profile</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {[
                          { label: 'Name', value: draft.settingsFields.name },
                          { label: 'Phone', value: draft.settingsFields.phone },
                          { label: 'Visa', value: draft.settingsFields.visaAuth },
                          { label: 'LinkedIn', value: draft.settingsFields.linkedinUrl },
                          { label: 'GitHub', value: draft.settingsFields.githubUrl },
                          { label: 'Website', value: draft.settingsFields.websiteUrl },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground w-14 shrink-0">{label}</span>
                            <span className="text-[11px] text-foreground truncate">{value ?? <span className="text-muted-foreground/50 italic">not set</span>}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cover letter template */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Cover Letter Template
                      </label>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Optional — used as the base for AI-generated cover letters for this ATS. Leave blank to use the default style.
                      </p>
                      <textarea
                        rows={4}
                        value={draft.fieldOverrides['cover_letter_template'] ?? ''}
                        onChange={(e) => updateDraft(profile.atsType, {
                          fieldOverrides: { ...draft.fieldOverrides, cover_letter_template: e.target.value },
                        })}
                        placeholder="e.g. Always start with a story about a technical challenge I solved. Keep it under 150 words. Mention the company name."
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background resize-none"
                      />
                    </div>

                    {/* Field overrides */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Field Overrides
                      </label>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Override specific field values for this ATS only. Use field keys like <code className="bg-muted px-1 rounded text-[10px]">years_experience</code>.
                      </p>
                      <div className="space-y-2">
                        {Object.entries(draft.fieldOverrides)
                          .filter(([k]) => k !== 'cover_letter_template')
                          .map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1.5 rounded-md w-40 truncate shrink-0">{key}</span>
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => updateDraft(profile.atsType, {
                                  fieldOverrides: { ...draft.fieldOverrides, [key]: e.target.value },
                                })}
                                className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                              />
                              <button
                                type="button"
                                onClick={() => removeOverride(profile.atsType, key)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={newOverrideKey[profile.atsType] ?? ''}
                            onChange={(e) => setNewOverrideKey((prev) => ({ ...prev, [profile.atsType]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOverride(profile.atsType))}
                            placeholder="field_key"
                            className="w-40 rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOverride(profile.atsType)}
                            className="h-7 gap-1 text-xs"
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Unanswered / unknown fields */}
                    {draft.unknownFields.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-amber-600 uppercase tracking-wide block mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Questions Needing Answers
                        </label>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          These are fields the extension encountered on {ATS_LABELS[profile.atsType] ?? profile.atsType} forms that it didn't know how to fill. Answer them here so future applies are complete.
                        </p>
                        <div className="space-y-2">
                          {draft.unknownFields.map((field, idx) => (
                            <div key={field.fieldKey} className="space-y-1">
                              <label className="text-[11px] font-medium text-foreground">{field.label}</label>
                              <input
                                type="text"
                                value={field.userValue}
                                onChange={(e) => {
                                  const next = [...draft.unknownFields];
                                  next[idx] = { ...field, userValue: e.target.value };
                                  updateDraft(profile.atsType, { unknownFields: next });
                                }}
                                placeholder="Your answer…"
                                className={cn(
                                  'w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                                  !field.userValue ? 'border-amber-400/50' : 'border-input',
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Save */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      {draft.updatedAt ? (
                        <span className="text-[11px] text-muted-foreground">
                          Last updated {new Date(draft.updatedAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Not yet configured</span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSave(profile.atsType)}
                        disabled={isSaving}
                        className="gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {profiles.length === 0 && !isLoading && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <Zap className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No profiles yet</p>
            <p className="mt-1">Use Quick Apply on a job to start building your autofill profiles.</p>
          </div>
        )}
      </div>
    </div>
  );
}
