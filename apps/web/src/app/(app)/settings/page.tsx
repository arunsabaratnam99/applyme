'use client';

import React from 'react';
import useSWR, { mutate } from 'swr';
import {
  User, FileText, Briefcase, Tag, AlertTriangle,
  LogOut, Save, ChevronRight, Globe, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { TagInput } from '@/components/settings/TagInput';
import { ResumeUpload, type ParsedResume } from '@/components/settings/ResumeUpload';
import { cn } from '@/lib/cn';

interface UserProfile {
  userId: string;
  displayName: string | null;
  country: string;
  locations: string[];
  roles: string[];
  keywords: string[];
  excludeKeywords: string[];
  preferredRemote: boolean;
  visaAuth: string;
  jobCategories: string[];
  employmentTypes: string[];
  salaryMin: number | null;
  salaryMax: number | null;
}

interface MeResponse {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  profile: UserProfile | null;
}

interface FormState {
  displayName: string;
  phone: string;
  country: string;
  locations: string[];
  preferredRemote: boolean;
  visaAuth: string;
  roles: string[];
  jobCategories: string[];
  employmentTypes: string[];
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: 'yearly' | 'hourly';
  keywords: string[];
  excludeKeywords: string[];
}

type TabId = 'profile' | 'resume' | 'preferences' | 'keywords' | 'danger';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',     label: 'Profile',       icon: <User className="h-4 w-4" /> },
  { id: 'resume',      label: 'Resume',        icon: <FileText className="h-4 w-4" /> },
  { id: 'preferences', label: 'Job Prefs',     icon: <Briefcase className="h-4 w-4" /> },
  { id: 'keywords',    label: 'Keywords',      icon: <Tag className="h-4 w-4" /> },
  { id: 'danger',      label: 'Danger Zone',   icon: <AlertTriangle className="h-4 w-4" /> },
];

const KEY = '/api/profile';

const DEFAULT_FORM: FormState = {
  displayName: '',
  phone: '',
  country: 'CA',
  locations: [],
  preferredRemote: false,
  visaAuth: 'citizen',
  roles: [],
  jobCategories: ['software'],
  employmentTypes: ['full_time'],
  salaryMin: '',
  salaryMax: '',
  salaryPeriod: 'yearly',
  keywords: [],
  excludeKeywords: [],
};

export default function SettingsPage() {
  const { data, isLoading } = useSWR<MeResponse>(KEY, (url: string) => api.get<MeResponse>(url));
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>('profile');
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [resumeFromFields, setResumeFromFields] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    setForm((prev) => ({
      ...prev,
      displayName: p.displayName ?? '',
      country: p.country ?? 'CA',
      locations: p.locations ?? [],
      preferredRemote: p.preferredRemote ?? false,
      visaAuth: p.visaAuth ?? 'citizen',
      roles: p.roles ?? [],
      jobCategories: p.jobCategories ?? [],
      employmentTypes: p.employmentTypes ?? [],
      salaryMin: p.salaryMin != null ? String(p.salaryMin) : '',
      salaryMax: p.salaryMax != null ? String(p.salaryMax) : '',
      keywords: p.keywords ?? [],
      excludeKeywords: p.excludeKeywords ?? [],
    }));
  }, [data]);

  function handleParsedResume(parsed: ParsedResume) {
    const touched: string[] = [];
    setForm((prev) => {
      const next = { ...prev };
      if (parsed.displayName && !prev.displayName) {
        next.displayName = parsed.displayName;
        touched.push('displayName');
      }
      if (parsed.roles?.length) {
        const merged = [...new Set([...prev.roles, ...parsed.roles])];
        next.roles = merged;
        parsed.roles.forEach((r) => touched.push(r));
      }
      if (parsed.keywords?.length) {
        const merged = [...new Set([...prev.keywords, ...parsed.keywords])];
        next.keywords = merged;
        parsed.keywords.forEach((k) => touched.push(k));
      }
      if (parsed.locations?.length) {
        const merged = [...new Set([...prev.locations, ...parsed.locations])];
        next.locations = merged;
        parsed.locations.forEach((l) => touched.push(l));
      }
      return next;
    });
    setResumeFromFields(touched);
    toast({ title: 'Resume parsed', description: 'Fields have been pre-filled from your resume.' });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(KEY, {
        displayName: form.displayName || null,
        country: form.country,
        locations: form.locations,
        preferredRemote: form.preferredRemote,
        visaAuth: form.visaAuth,
        roles: form.roles,
        jobCategories: form.jobCategories,
        employmentTypes: form.employmentTypes,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        keywords: form.keywords,
        excludeKeywords: form.excludeKeywords,
      });
      await mutate(KEY);
      toast({ title: 'Profile saved' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
      window.location.href = '/login';
    } catch {
      toast({ title: 'Failed to sign out', variant: 'destructive' });
    }
  }

  const avatarChar = (data?.name ?? data?.email ?? 'U').charAt(0).toUpperCase();

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-52 border-r border-border p-4 space-y-1 shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="flex-1 p-8 space-y-5 max-w-2xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar nav ── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col py-6 px-3 gap-1">
        {/* User identity */}
        <div className="flex items-center gap-2.5 px-2 pb-5 mb-1 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm shrink-0">
            {avatarChar}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{data?.name ?? 'You'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{data?.email ?? ''}</p>
          </div>
        </div>

        {/* Tabs */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium transition-all text-left',
              activeTab === tab.id
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <span className={cn(activeTab === tab.id ? 'text-primary' : 'text-muted-foreground')}>
              {tab.icon}
            </span>
            {tab.label}
            {activeTab === tab.id && <ChevronRight className="h-3 w-3 ml-auto opacity-50" />}
          </button>
        ))}

        {/* Sign out at bottom */}
        <div className="mt-auto pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <form onSubmit={handleSave}>
          <div className="max-w-2xl mx-auto px-8 py-8">

            {/* ── Profile tab ── */}
            {activeTab === 'profile' && (
              <Section title="Profile" description="How you appear and your work authorization status.">
                <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shrink-0">
                    {avatarChar}
                  </div>
                  <div>
                    <p className="font-semibold">{data?.name ?? 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground">{data?.email ?? 'No email on file'}</p>
                    <p className="text-xs text-muted-foreground mt-1 italic">Avatar is set by your OAuth provider</p>
                  </div>
                </div>

                <FieldRow label="Display name" hint="Used in autofill and application drafts">
                  <TextInput
                    value={form.displayName}
                    onChange={(v) => setForm({ ...form, displayName: v })}
                    placeholder="Jane Smith"
                    icon={<User className="h-4 w-4" />}
                    highlighted={resumeFromFields.includes('displayName')}
                  />
                </FieldRow>

                <FieldRow label="Phone number" hint="Optional — for autofill on application forms">
                  <TextInput
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    placeholder="+1 (416) 555-0100"
                    type="tel"
                  />
                </FieldRow>

                <FieldRow label="Country" hint="Used to filter jobs to your country">
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                    >
                      <option value="CA">🇨🇦 Canada</option>
                      <option value="US">🇺🇸 United States</option>
                      <option value="GB">🇬🇧 United Kingdom</option>
                      <option value="AU">🇦🇺 Australia</option>
                    </select>
                  </div>
                </FieldRow>

                <FieldRow label="Work authorization" hint="Filters out jobs that require different visa status">
                  <select
                    value={form.visaAuth}
                    onChange={(e) => setForm({ ...form, visaAuth: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                  >
                    <option value="citizen">Citizen / Permanent Resident</option>
                    <option value="work_permit">Open Work Permit</option>
                    <option value="student_visa">Study / Co-op Permit</option>
                    <option value="visa_required">Need visa sponsorship</option>
                  </select>
                </FieldRow>

                <SaveBar saving={saving} />
              </Section>
            )}

            {/* ── Resume tab ── */}
            {activeTab === 'resume' && (
              <Section title="Resume" description="Upload your resume and we'll auto-fill your profile fields.">
                <ResumeUpload onParsed={handleParsedResume} />

                <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-1">What gets auto-filled?</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Your name → Display name</li>
                    <li>Job titles &amp; roles → Target roles</li>
                    <li>Skills &amp; technologies → Keywords</li>
                    <li>Cities &amp; regions → Preferred locations</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    Pre-filled fields are marked with an <span className="font-semibold text-primary">AI</span> badge. You can edit or remove them at any time.
                  </p>
                </div>
              </Section>
            )}

            {/* ── Job Preferences tab ── */}
            {activeTab === 'preferences' && (
              <Section title="Job Preferences" description="Define what kinds of jobs you want to see and apply to.">
                <FieldRow label="Target roles" hint="Job titles you're looking for">
                  <TagInput
                    tags={form.roles}
                    onChange={(tags) => setForm({ ...form, roles: tags })}
                    placeholder="Software Engineer, PM, Designer…"
                    fromResume={resumeFromFields}
                  />
                </FieldRow>

                <FieldRow label="Preferred locations" hint="Cities or regions (leave empty for all Canada)">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <TagInput
                        tags={form.locations}
                        onChange={(tags) => setForm({ ...form, locations: tags })}
                        placeholder="Toronto, Vancouver, Remote…"
                        fromResume={resumeFromFields}
                      />
                    </div>
                    <label className="flex items-center gap-2 shrink-0 rounded-lg border border-border bg-background px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                      <div className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        form.preferredRemote ? 'bg-primary' : 'bg-muted-foreground/30',
                      )}>
                        <span className={cn(
                          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                          form.preferredRemote ? 'translate-x-4' : 'translate-x-0.5',
                        )} />
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.preferredRemote}
                        onChange={(e) => setForm({ ...form, preferredRemote: e.target.checked })}
                      />
                      <span className="text-xs font-medium text-foreground">Remote first</span>
                    </label>
                  </div>
                </FieldRow>

                <FieldRow label="Employment types" hint="Select all that apply">
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: 'full_time', label: 'Full-time' },
                      { id: 'part_time', label: 'Part-time' },
                      { id: 'internship', label: 'Internship' },
                      { id: 'co_op', label: 'Co-op' },
                      { id: 'contract', label: 'Contract' },
                    ] as const).map((t) => {
                      const checked = form.employmentTypes.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setForm({
                            ...form,
                            employmentTypes: checked
                              ? form.employmentTypes.filter((x) => x !== t.id)
                              : [...form.employmentTypes, t.id],
                          })}
                          className={cn(
                            'rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all',
                            checked
                              ? 'border-primary bg-primary/12 text-primary'
                              : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                          )}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </FieldRow>

                <FieldRow label="Job categories" hint="Types of roles to include in your feed">
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: 'software', label: 'Software' },
                      { id: 'data', label: 'Data / ML' },
                      { id: 'design', label: 'Design' },
                      { id: 'product', label: 'Product' },
                      { id: 'business', label: 'Business' },
                      { id: 'devops', label: 'DevOps / Infra' },
                      { id: 'security', label: 'Security' },
                      { id: 'qa', label: 'QA / Testing' },
                    ] as const).map((c) => {
                      const checked = form.jobCategories.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setForm({
                            ...form,
                            jobCategories: checked
                              ? form.jobCategories.filter((x) => x !== c.id)
                              : [...form.jobCategories, c.id],
                          })}
                          className={cn(
                            'rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all',
                            checked
                              ? 'border-primary bg-primary/12 text-primary'
                              : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                          )}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </FieldRow>

                <FieldRow label="Salary range" hint="Jobs below this range are scored lower">
                  <div className="space-y-2">
                    <div className="flex gap-1 rounded-lg border border-border bg-muted p-0.5 w-fit">
                      {(['yearly', 'hourly'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setForm({ ...form, salaryPeriod: p, salaryMin: '', salaryMax: '' })}
                          className={cn(
                            'rounded-md px-3 py-1 text-xs font-medium transition-all',
                            form.salaryPeriod === p
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {p === 'yearly' ? 'Per year' : 'Per hour'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          value={form.salaryMin}
                          onChange={(e) => setForm({ ...form, salaryMin: e.target.value })}
                          placeholder={form.salaryPeriod === 'yearly' ? '60,000' : '25'}
                          className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                        />
                      </div>
                      <span className="text-muted-foreground text-sm">—</span>
                      <div className="relative flex-1">
                        <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          value={form.salaryMax}
                          onChange={(e) => setForm({ ...form, salaryMax: e.target.value })}
                          placeholder={form.salaryPeriod === 'yearly' ? '120,000' : '60'}
                          className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {form.salaryPeriod === 'yearly' ? 'CAD/yr' : 'CAD/hr'}
                      </span>
                    </div>
                  </div>
                </FieldRow>

                <SaveBar saving={saving} />
              </Section>
            )}

            {/* ── Keywords tab ── */}
            {activeTab === 'keywords' && (
              <Section title="Keywords" description="Fine-tune which jobs get surfaced and which get hidden.">
                <FieldRow
                  label="Include keywords"
                  hint="Jobs matching these terms get a score boost"
                >
                  <TagInput
                    tags={form.keywords}
                    onChange={(tags) => setForm({ ...form, keywords: tags })}
                    placeholder="React, TypeScript, Go, Kubernetes…"
                    fromResume={resumeFromFields}
                  />
                </FieldRow>

                <FieldRow
                  label="Exclude keywords"
                  hint="Jobs containing these terms are hidden from your feed"
                >
                  <TagInput
                    tags={form.excludeKeywords}
                    onChange={(tags) => setForm({ ...form, excludeKeywords: tags })}
                    placeholder="C++, Blockchain, Gambling…"
                  />
                </FieldRow>

                <div className="rounded-xl border border-border bg-muted/30 p-4 mt-2">
                  <p className="text-sm font-medium mb-1">How keywords work</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Include keywords in the job title → +15 score</li>
                    <li>Include keywords in description → +5 score</li>
                    <li>Exclude keywords anywhere → job is hidden</li>
                  </ul>
                </div>

                <SaveBar saving={saving} />
              </Section>
            )}

            {/* ── Danger Zone tab ── */}
            {activeTab === 'danger' && (
              <Section title="Danger Zone" description="Irreversible actions — proceed with caution.">
                <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Sign out</p>
                      <p className="text-xs text-muted-foreground mt-0.5">End your current session on this device.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                      <LogOut className="h-3.5 w-3.5 mr-1.5" />
                      Sign out
                    </Button>
                  </div>
                  <div className="border-t border-destructive/15" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-destructive">Delete account</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Permanently delete your account and all associated data. This cannot be undone.</p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled
                      title="Contact support to delete your account"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Section>
            )}

          </div>
        </form>
      </main>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text', icon, highlighted,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border bg-background py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors',
          icon ? 'pl-9 pr-3' : 'px-3',
          highlighted ? 'border-primary/50 bg-primary/5' : 'border-input',
        )}
      />
      {highlighted && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wide text-primary opacity-70">
          AI
        </span>
      )}
    </div>
  );
}

function SaveBar({ saving }: { saving: boolean }) {
  return (
    <div className="pt-4 border-t border-border flex justify-end">
      <Button type="submit" disabled={saving} className="gap-2 px-6">
        <Save className="h-4 w-4" />
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}
