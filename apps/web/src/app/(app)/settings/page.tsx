'use client';

import React from 'react';
import useSWR, { mutate } from 'swr';
import {
  User, FileText, Briefcase, Tag, AlertTriangle,
  LogOut, Save, ChevronRight, Globe, DollarSign,
  Camera, Download, Loader2, CheckCircle2, Eye, Lock,
  Zap, Linkedin, Github, Link2, RefreshCw, Database, Mail, X, Plus, ClipboardList, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { TagInput } from '@/components/settings/TagInput';
import { UniversityAutocomplete } from '@/components/settings/UniversityAutocomplete';
import { CompanyInput } from '@/components/settings/CompanyInput';
import { CityInput } from '@/components/settings/CityInput';
import { ResumeUpload, type ParsedResume, type WorkEntry, type EducationEntry } from '@/components/settings/ResumeUpload';
import { cn } from '@/lib/cn';

interface UserProfile {
  userId: string;
  displayName: string | null;
  customAvatarUrl: string | null;
  country: string | null;
  locations: string[] | null;
  roles: string[] | null;
  keywords: string[] | null;
  excludeKeywords: string[] | null;
  preferredRemote: boolean | null;
  visaAuth: string | null;
  jobCategories: string[] | null;
  employmentTypes: string[] | null;
  salaryMin: number | null;
  salaryMax: number | null;
  dealBreakerFields: { employmentTypes: boolean; jobCategories: boolean; workplaceType: boolean } | null;
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  applyEmail: string | null;
  quickApplyAll: boolean | null;
  tier1QuickApply: boolean | null;
  headline: string | null;
  summary: string | null;
  yearsOfExperience: number | null;
  workExperience: WorkEntry[] | null;
  education: EducationEntry[] | null;
  earliestStartDate: string | null;
  willingToRelocate: boolean | null;
  preferredPronouns: string | null;
  ethnicity: string | null;
  veteranStatus: string | null;
  disabilityStatus: string | null;
}

interface ResumeVersion {
  id: string;
  versionLabel: string;
  mimeType: string;
  fileSizeBytes: string | null;
  createdAt: string;
}

interface Resume {
  id: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
  versions: ResumeVersion[];
}

interface MeResponse {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

interface DealBreakerFields {
  employmentTypes: boolean;
  jobCategories: boolean;
  workplaceType: boolean;
}

interface FormState {
  displayName: string;
  firstName: string;
  lastName: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
  applyEmail: string;
  location: string;
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
  dealBreakerFields: DealBreakerFields;
  quickApplyAll: boolean;
  tier1QuickApply: boolean;
  headline: string;
  summary: string;
  yearsOfExperience: string;
  workExperience: WorkEntry[];
  education: EducationEntry[];
  earliestStartDate: string;
  willingToRelocate: boolean;
  preferredPronouns: string;
  ethnicity: string;
  veteranStatus: string;
  disabilityStatus: string;
}

type TabId = 'profile' | 'appinfo' | 'resume' | 'preferences' | 'keywords' | 'quickapply' | 'data' | 'danger';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',     label: 'Profile',       icon: <User className="h-4 w-4" /> },
  { id: 'appinfo',     label: 'App Info',      icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'resume',      label: 'Resume',        icon: <FileText className="h-4 w-4" /> },
  { id: 'preferences', label: 'Job Prefs',     icon: <Briefcase className="h-4 w-4" /> },
  { id: 'keywords',    label: 'Keywords',      icon: <Tag className="h-4 w-4" /> },
  { id: 'quickapply',  label: 'Quick Apply',   icon: <Zap className="h-4 w-4" /> },
  { id: 'data',        label: 'Data',          icon: <Database className="h-4 w-4" /> },
  { id: 'danger',      label: 'Danger Zone',   icon: <AlertTriangle className="h-4 w-4" /> },
];

const KEY = '/api/profile';
const ME_KEY = '/api/profile/me';

const RESUMES_KEY = '/api/resumes';

const DEFAULT_FORM: FormState = {
  displayName: '',
  firstName: '',
  lastName: '',
  phone: '',
  linkedinUrl: '',
  githubUrl: '',
  websiteUrl: '',
  applyEmail: '',
  location: '',
  country: 'CA',
  locations: [],
  preferredRemote: false,
  visaAuth: 'citizen',
  roles: [],
  jobCategories: [],
  employmentTypes: [],
  salaryMin: '',
  salaryMax: '',
  salaryPeriod: 'yearly',
  keywords: [],
  excludeKeywords: [],
  dealBreakerFields: { employmentTypes: false, jobCategories: false, workplaceType: false },
  quickApplyAll: true,
  tier1QuickApply: false,
  headline: '',
  summary: '',
  yearsOfExperience: '',
  workExperience: [],
  education: [],
  earliestStartDate: '',
  willingToRelocate: false,
  preferredPronouns: '',
  ethnicity: '',
  veteranStatus: '',
  disabilityStatus: '',
};

// ─── Confirm Modal ───────────────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ open, title, message, confirmLabel = 'Overwrite', cancelLabel = 'Keep existing', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-accent transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: profile, isLoading } = useSWR<UserProfile | null>(KEY, (url: string) => api.get<UserProfile | null>(url));
  const { data: me } = useSWR<MeResponse>(ME_KEY, (url: string) => api.get<MeResponse>(url));
  const { data: resumes, mutate: mutateResumes } = useSWR<Resume[]>(RESUMES_KEY, (url: string) => api.get<Resume[]>(url));
  const [saving, setSaving] = React.useState(false);
  const [autoSaving, setAutoSaving] = React.useState(false);
  const [autoSaved, setAutoSaved] = React.useState(false);
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>('profile');
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [workCollapsed, setWorkCollapsed] = React.useState<boolean[]>([]);
  const [eduCollapsed, setEduCollapsed] = React.useState<boolean[]>([]);
  const [resumeFromFields, setResumeFromFields] = React.useState<string[]>([]);
  const [suggestedKeywords, setSuggestedKeywords] = React.useState<string[]>([]);
  const [dismissedKeywords, setDismissedKeywords] = React.useState<Set<string>>(new Set());
  const [resumeUploadKey, setResumeUploadKey] = React.useState(0);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmModal, setConfirmModal] = React.useState<{ open: boolean; title: string; message: string; resolve: (v: boolean) => void } | null>(null);

  function showConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmModal({ open: true, title, message, resolve });
    });
  }

  React.useEffect(() => {
    if (!profile) return;
    const p = profile;
    setForm((prev) => ({
      ...prev,
      displayName: p.displayName ?? '',
      firstName: p.displayName ? (p.displayName.split(' ')[0] ?? '') : '',
      lastName: p.displayName ? (p.displayName.split(' ').slice(1).join(' ') ?? '') : '',
      phone: p.phone ?? '',
      location: (p.locations ?? [])[0] ?? '',
      linkedinUrl: p.linkedinUrl ?? '',
      githubUrl: p.githubUrl ?? '',
      websiteUrl: p.websiteUrl ?? '',
      applyEmail: p.applyEmail ?? '',
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
      dealBreakerFields: p.dealBreakerFields ?? { employmentTypes: false, jobCategories: false, workplaceType: false },
      quickApplyAll: p.quickApplyAll ?? true,
      tier1QuickApply: p.tier1QuickApply ?? false,
      headline: p.headline ?? '',
      summary: p.summary ?? '',
      yearsOfExperience: p.yearsOfExperience != null ? String(p.yearsOfExperience) : '',
      workExperience: p.workExperience ?? [],
      education: p.education ?? [],
      earliestStartDate: p.earliestStartDate ?? '',
      willingToRelocate: p.willingToRelocate ?? false,
      preferredPronouns: p.preferredPronouns ?? '',
      ethnicity: p.ethnicity ?? '',
      veteranStatus: p.veteranStatus ?? '',
      disabilityStatus: p.disabilityStatus ?? '',
    }));
  }, [profile]);

  /** Formats a phone number string to +1 (416) 555-1234 style */
  function formatPhone(v: string): string {
    const digits = v.replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '1') {
      const d = digits.slice(1);
      return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length >= 7) {
      const d = digits.slice(-10);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return v;
  }

  /** Returns s if it's a valid absolute URL, otherwise null */
  function validUrl(s: string | undefined | null): string | null {
    if (!s) return null;
    try { new URL(s); return s; } catch { return null; }
  }

  /** Returns s if it looks like a valid email, otherwise null */
  function validEmail(s: string | undefined | null): string | null {
    if (!s) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
  }

  async function handleParsedResume(parsed: ParsedResume) {
    const touched: string[] = [];
    const prev = form;

    // Determine which fields would be overwritten (already have a value)
    const willOverwrite: string[] = [];
    if (parsed.firstName && prev.firstName) willOverwrite.push('First name');
    if (parsed.lastName && prev.lastName) willOverwrite.push('Last name');
    if (parsed.email && prev.applyEmail) willOverwrite.push('Email');
    if (parsed.phone && prev.phone) willOverwrite.push('Phone');
    if (parsed.linkedinUrl && prev.linkedinUrl) willOverwrite.push('LinkedIn');
    if (parsed.githubUrl && prev.githubUrl) willOverwrite.push('GitHub');
    if (parsed.websiteUrl && prev.websiteUrl) willOverwrite.push('Website');
    if (parsed.workExperience?.length && prev.workExperience.length) willOverwrite.push('Work experience');
    if (parsed.education?.length && prev.education.length) willOverwrite.push('Education');

    let overwrite = true;
    if (willOverwrite.length > 0) {
      overwrite = await showConfirm(
        'Resume data found',
        `Your resume has updated info for: ${willOverwrite.join(', ')}.\n\nOverwrite existing data with resume data?`
      );
    }

    const next: FormState = { ...prev };

    const shouldFill = (field: string) => overwrite || !willOverwrite.includes(field);

    if (parsed.firstName && shouldFill('First name')) { next.firstName = parsed.firstName; touched.push('firstName'); }
    if (parsed.lastName && shouldFill('Last name')) { next.lastName = parsed.lastName; touched.push('lastName'); }
    if (parsed.firstName || parsed.lastName) {
      next.displayName = [next.firstName, next.lastName].filter(Boolean).join(' ');
      touched.push('displayName');
    }
    if (parsed.location) { next.location = parsed.location; touched.push('location'); }
    if (parsed.email && shouldFill('Email')) { next.applyEmail = parsed.email; touched.push('applyEmail'); }
    if (parsed.phone && shouldFill('Phone')) { next.phone = parsed.phone; touched.push('phone'); }
    if (parsed.linkedinUrl && shouldFill('LinkedIn')) { next.linkedinUrl = parsed.linkedinUrl; touched.push('linkedinUrl'); }
    if (parsed.githubUrl && shouldFill('GitHub')) { next.githubUrl = parsed.githubUrl; touched.push('githubUrl'); }
    if (parsed.websiteUrl && shouldFill('Website')) { next.websiteUrl = parsed.websiteUrl; touched.push('websiteUrl'); }
    if (parsed.headline) { next.headline = parsed.headline; touched.push('headline'); }
    if (parsed.summary) { next.summary = parsed.summary; touched.push('summary'); }
    if (parsed.yearsOfExperience != null) { next.yearsOfExperience = String(parsed.yearsOfExperience); touched.push('yearsOfExperience'); }
    if (parsed.workExperience?.length && shouldFill('Work experience')) { next.workExperience = parsed.workExperience; touched.push('workExperience'); }
    if (parsed.education?.length && shouldFill('Education')) { next.education = parsed.education; touched.push('education'); }
    if (parsed.roles?.length) {
      next.roles = [...new Set([...prev.roles, ...parsed.roles])];
      touched.push('roles');
    }
    if (parsed.keywords?.length) {
      next.keywords = [...new Set([...prev.keywords, ...parsed.keywords])];
      touched.push('keywords');
      setSuggestedKeywords(parsed.keywords);
      setDismissedKeywords(new Set());
    }
    if (parsed.locations?.length) {
      next.locations = [...new Set([...prev.locations, ...parsed.locations])];
      touched.push('locations');
    }

    setForm(next);
    setResumeFromFields(touched);
    toast({ title: 'Resume parsed', description: 'Fields have been pre-filled — saving automatically…' });

    // Auto-save immediately so DB is updated without requiring manual Save click
    const clean = (arr: string[]) => [...new Set(arr.filter((s) => s.trim().length > 0))];
    try {
      const loc = parsed.location?.trim();
      const allLocations = clean(loc ? [loc, ...next.locations] : next.locations);
      const payload = {
        displayName: next.displayName || null,
        phone: next.phone || null,
        linkedinUrl: validUrl(next.linkedinUrl),
        githubUrl: validUrl(next.githubUrl),
        websiteUrl: validUrl(next.websiteUrl),
        applyEmail: validEmail(next.applyEmail) ?? validEmail(me?.email) ?? null,
        locations: allLocations,
        roles: clean(next.roles),
        keywords: clean(next.keywords),
        headline: next.headline || null,
        summary: next.summary || null,
        yearsOfExperience: next.yearsOfExperience ? Number(next.yearsOfExperience) : null,
        workExperience: next.workExperience.map((e) => ({ ...e, description: (e.description ?? '').slice(0, 950) })),
        education: next.education.map((e) => ({ ...e, institution: (e.institution ?? '').slice(0, 190), degree: (e.degree ?? '').slice(0, 190), field: (e.field ?? '').slice(0, 190) })),
        preferredPronouns: next.preferredPronouns || null,
        ethnicity: next.ethnicity || null,
        veteranStatus: next.veteranStatus || null,
        disabilityStatus: next.disabilityStatus || null,
      };
      await api.put(KEY, payload);
      await mutate(KEY);
      toast({ title: 'Profile updated', description: 'Resume data saved to your profile.' });
    } catch (err) {
      const msg = (err != null && typeof err === 'object' && 'message' in err)
        ? String((err as { message: unknown }).message)
        : String(err);
      toast({ title: 'Auto-save failed', description: msg, variant: 'destructive' });
    }
  }

  async function autoSaveAppInfo(f: FormState) {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaved(false);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        await api.put(KEY, {
          displayName: [f.firstName, f.lastName].filter(Boolean).join(' ') || f.displayName || null,
          phone: f.phone || null,
          linkedinUrl: validUrl(f.linkedinUrl),
          githubUrl: validUrl(f.githubUrl),
          websiteUrl: validUrl(f.websiteUrl),
          applyEmail: validEmail(f.applyEmail) ?? validEmail(me?.email) ?? null,
          locations: f.location ? [...new Set([f.location, ...f.locations])] : f.locations,
          headline: f.headline || null,
          summary: f.summary || null,
          yearsOfExperience: f.yearsOfExperience ? Number(f.yearsOfExperience) : null,
          workExperience: f.workExperience.map((e) => ({ ...e, description: (e.description ?? '').slice(0, 950) })),
          education: f.education.map((e) => ({ ...e, institution: (e.institution ?? '').slice(0, 190), degree: (e.degree ?? '').slice(0, 190), field: (e.field ?? '').slice(0, 190) })),
          visaAuth: f.visaAuth || null,
          earliestStartDate: f.earliestStartDate || null,
          willingToRelocate: f.willingToRelocate,
          preferredPronouns: f.preferredPronouns || null,
          ethnicity: f.ethnicity || null,
          veteranStatus: f.veteranStatus || null,
          disabilityStatus: f.disabilityStatus || null,
        });
        await mutate(KEY);
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 2500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: 'Auto-save failed', description: msg, variant: 'destructive' });
      } finally {
        setAutoSaving(false);
      }
    }, 1200);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(KEY, {
        displayName: [form.firstName, form.lastName].filter(Boolean).join(' ') || form.displayName || null,
        phone: form.phone || null,
        linkedinUrl: validUrl(form.linkedinUrl),
        githubUrl: validUrl(form.githubUrl),
        websiteUrl: validUrl(form.websiteUrl),
        applyEmail: validEmail(form.applyEmail) ?? validEmail(me?.email) ?? null,
        country: form.country,
        locations: form.location ? [...new Set([form.location, ...form.locations])] : form.locations,
        preferredRemote: form.preferredRemote,
        visaAuth: form.visaAuth,
        roles: form.roles,
        jobCategories: form.jobCategories,
        employmentTypes: form.employmentTypes,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        keywords: form.keywords,
        excludeKeywords: form.excludeKeywords,
        dealBreakerFields: form.dealBreakerFields,
        quickApplyAll: form.quickApplyAll,
        tier1QuickApply: form.tier1QuickApply,
        headline: form.headline || null,
        summary: form.summary || null,
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        workExperience: form.workExperience.map((e) => ({ ...e, description: (e.description ?? '').slice(0, 950) })),
        education: form.education.map((e) => ({ ...e, institution: (e.institution ?? '').slice(0, 190), degree: (e.degree ?? '').slice(0, 190), field: (e.field ?? '').slice(0, 190) })),
        earliestStartDate: form.earliestStartDate || null,
        willingToRelocate: form.willingToRelocate,
        preferredPronouns: form.preferredPronouns || null,
        ethnicity: form.ethnicity || null,
        veteranStatus: form.veteranStatus || null,
        disabilityStatus: form.disabilityStatus || null,
      });
      await mutate(KEY);
      toast({ title: 'Profile saved' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Failed to save', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      await mutate(KEY);
      toast({ title: 'Profile picture updated' });
    } catch {
      toast({ title: 'Failed to upload picture', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleDownloadResume(resumeId: string, versionId: string, view = false) {
    try {
      const { downloadUrl } = await api.get<{ downloadUrl: string }>(`/api/resumes/${resumeId}/versions/${versionId}/download`);
      if (view) {
        window.open(downloadUrl, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = '';
        a.click();
      }
    } catch {
      toast({ title: 'Failed to get download link', variant: 'destructive' });
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

  const avatarChar = (me?.name ?? me?.email ?? 'U').charAt(0).toUpperCase();
  const avatarUrl = profile?.customAvatarUrl ?? me?.avatarUrl ?? null;
  const defaultResume = resumes?.find((r) => r.isDefault) ?? resumes?.[0] ?? null;
  const defaultVersion = defaultResume?.versions[defaultResume.versions.length - 1] ?? null;

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
      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={() => { setConfirmModal(null); confirmModal.resolve(true); }}
          onCancel={() => { setConfirmModal(null); confirmModal.resolve(false); }}
        />
      )}
      {/* ── Sidebar nav ── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col py-6 px-3 gap-1">
        {/* User identity */}
        <div className="flex items-center gap-2.5 px-2 pb-5 mb-1 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm shrink-0">
            {avatarChar}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{me?.name ?? 'You'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{me?.email ?? ''}</p>
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
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="relative h-16 w-16 rounded-full shrink-0 group focus:outline-none"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                        {avatarChar}
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {avatarUploading
                        ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                        : <Camera className="h-5 w-5 text-white" />}
                    </div>
                  </button>
                  <div>
                    <p className="font-semibold">{me?.name ?? 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground">{me?.email ?? 'No email on file'}</p>
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

                <FieldRow label="Apply email" hint="Email used on job applications — defaults to your login email">
                  <TextInput
                    value={form.applyEmail}
                    onChange={(v) => setForm({ ...form, applyEmail: v })}
                    placeholder={me?.email ?? 'your@email.com'}
                    icon={<Mail className="h-4 w-4" />}
                  />
                </FieldRow>

                <FieldRow label="Phone number" hint="Optional — for autofill on application forms">
                  <TextInput
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: formatPhone(v) })}
                    placeholder="+1 (416) 555-0100"
                    type="tel"
                  />
                </FieldRow>

                <FieldRow label="LinkedIn URL" hint="Used in autofill profiles">
                  <TextInput
                    value={form.linkedinUrl}
                    onChange={(v) => setForm({ ...form, linkedinUrl: v })}
                    placeholder="https://linkedin.com/in/yourname"
                    icon={<Linkedin className="h-4 w-4" />}
                  />
                </FieldRow>

                <FieldRow label="GitHub URL" hint="Used in autofill profiles">
                  <TextInput
                    value={form.githubUrl}
                    onChange={(v) => setForm({ ...form, githubUrl: v })}
                    placeholder="https://github.com/yourname"
                    icon={<Github className="h-4 w-4" />}
                  />
                </FieldRow>

                <FieldRow label="Website / Portfolio" hint="Used in autofill profiles">
                  <TextInput
                    value={form.websiteUrl}
                    onChange={(v) => setForm({ ...form, websiteUrl: v })}
                    placeholder="https://yoursite.com"
                    icon={<Link2 className="h-4 w-4" />}
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

            {/* ── Application Info tab ── */}
            {activeTab === 'appinfo' && (
              <Section
                title="Application Info"
                description="Autofilled from your resume. Used to fill out job applications instantly."
                headerRight={
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {autoSaving && <><Loader2 className="h-3 w-3 animate-spin" />Saving…</>}
                    {!autoSaving && autoSaved && <><CheckCircle2 className="h-3 w-3 text-green-500" />Saved</>}
                  </span>
                }
              >

                {/* ── Personal info ── */}
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="First name">
                    <TextInput
                      value={form.firstName}
                      onChange={(v) => { const f = { ...form, firstName: v }; setForm(f); autoSaveAppInfo(f); }}
                      placeholder="Jane"
                      highlighted={resumeFromFields.includes('firstName')}
                    />
                  </FieldRow>
                  <FieldRow label="Last name">
                    <TextInput
                      value={form.lastName}
                      onChange={(v) => { const f = { ...form, lastName: v }; setForm(f); autoSaveAppInfo(f); }}
                      placeholder="Smith"
                      highlighted={resumeFromFields.includes('lastName')}
                    />
                  </FieldRow>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Email">
                    <TextInput
                      value={form.applyEmail}
                      onChange={(v) => { const f = { ...form, applyEmail: v }; setForm(f); autoSaveAppInfo(f); }}
                      placeholder="jane@example.com"
                      icon={<Mail className="h-4 w-4" />}
                      highlighted={resumeFromFields.includes('applyEmail')}
                    />
                  </FieldRow>
                  <FieldRow label="Phone number">
                    <TextInput
                      value={form.phone}
                      onChange={(v) => { const f = { ...form, phone: formatPhone(v) }; setForm(f); autoSaveAppInfo(f); }}
                      placeholder="+1 (416) 555-0100"
                      highlighted={resumeFromFields.includes('phone')}
                    />
                  </FieldRow>
                </div>

                <FieldRow label="Location" hint="City, Province / State">
                  <CityInput
                    value={form.location}
                    onChange={(v) => { const f = { ...form, location: v }; setForm(f); autoSaveAppInfo(f); }}
                    placeholder="Toronto, ON"
                    highlighted={resumeFromFields.includes('location')}
                  />
                </FieldRow>

                {/* ── Online presence ── */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Online</p>
                  <div className="space-y-4">
                    <FieldRow label="LinkedIn">
                      <TextInput
                        value={form.linkedinUrl}
                        onChange={(v) => { const f = { ...form, linkedinUrl: v }; setForm(f); autoSaveAppInfo(f); }}
                        placeholder="https://linkedin.com/in/janesmith"
                        icon={<Linkedin className="h-4 w-4" />}
                        highlighted={resumeFromFields.includes('linkedinUrl')}
                      />
                    </FieldRow>
                    <FieldRow label="GitHub">
                      <TextInput
                        value={form.githubUrl}
                        onChange={(v) => { const f = { ...form, githubUrl: v }; setForm(f); autoSaveAppInfo(f); }}
                        placeholder="https://github.com/janesmith"
                        icon={<Github className="h-4 w-4" />}
                        highlighted={resumeFromFields.includes('githubUrl')}
                      />
                    </FieldRow>
                    <FieldRow label="Website / Portfolio">
                      <TextInput
                        value={form.websiteUrl}
                        onChange={(v) => { const f = { ...form, websiteUrl: v }; setForm(f); autoSaveAppInfo(f); }}
                        placeholder="https://janesmith.dev"
                        icon={<Link2 className="h-4 w-4" />}
                        highlighted={resumeFromFields.includes('websiteUrl')}
                      />
                    </FieldRow>
                  </div>
                </div>

                {/* ── Work experience ── */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Experience</p>
                    </div>
                  </div>
                  <WorkExperienceEditor
                    entries={form.workExperience}
                    fromResume={resumeFromFields.includes('workExperience')}
                    onChange={(entries) => { const f = { ...form, workExperience: entries }; setForm(f); autoSaveAppInfo(f); }}
                    collapsed={workCollapsed}
                    onCollapsedChange={setWorkCollapsed}
                  />
                </div>

                {/* ── Education ── */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Education</p>
                    </div>
                  </div>
                  <EducationEditor
                    entries={form.education}
                    fromResume={resumeFromFields.includes('education')}
                    onChange={(entries) => { const f = { ...form, education: entries }; setForm(f); autoSaveAppInfo(f); }}
                    collapsed={eduCollapsed}
                    onCollapsedChange={setEduCollapsed}
                  />
                </div>

                {/* ── Application Defaults ── */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Application Defaults</p>
                  <p className="text-xs text-muted-foreground mb-4">Used to auto-answer common application questions.</p>

                  <div className="grid grid-cols-1 gap-4">
                    <FieldRow label="Work authorization" hint="Your right to work status">
                      <select
                        value={form.visaAuth}
                        onChange={(e) => { const f = { ...form, visaAuth: e.target.value }; setForm(f); autoSaveAppInfo(f); }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="">Not specified</option>
                        <option value="citizen">Citizen</option>
                        <option value="permanent_resident">Permanent Resident</option>
                        <option value="work_permit">Work Permit / Visa</option>
                        <option value="student_visa">Student Visa</option>
                        <option value="needs_sponsorship">Require Sponsorship</option>
                      </select>
                    </FieldRow>

                    <FieldRow label="Sponsorship required" hint="Do you need the employer to sponsor your visa?">
                      <select
                        value={form.visaAuth === 'needs_sponsorship' ? 'yes' : form.visaAuth ? 'no' : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = val === 'yes' ? 'needs_sponsorship' : val === 'no' ? (form.visaAuth === 'needs_sponsorship' ? 'work_permit' : form.visaAuth) : form.visaAuth;
                          const f = { ...form, visaAuth: next };
                          setForm(f);
                          autoSaveAppInfo(f);
                        }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="">Not specified</option>
                        <option value="no">No — I do not need sponsorship</option>
                        <option value="yes">Yes — I require sponsorship</option>
                      </select>
                    </FieldRow>

                    <FieldRow label="Earliest start date">
                      <select
                        value={form.earliestStartDate}
                        onChange={(e) => { const f = { ...form, earliestStartDate: e.target.value }; setForm(f); autoSaveAppInfo(f); }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="">Not specified</option>
                        <option value="Immediately">Immediately</option>
                        <option value="2 weeks">2 weeks notice</option>
                        <option value="1 month">1 month notice</option>
                        <option value="2 months">2 months notice</option>
                        <option value="3 months">3 months notice</option>
                        <option value="After graduation">After graduation</option>
                        <option value="Flexible">Flexible</option>
                      </select>
                    </FieldRow>

                    <FieldRow label="Willing to relocate">
                      <select
                        value={form.willingToRelocate ? 'yes' : 'no'}
                        onChange={(e) => { const f = { ...form, willingToRelocate: e.target.value === 'yes' }; setForm(f); autoSaveAppInfo(f); }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </FieldRow>
                  </div>
                </div>

                {/* ── DEI ── */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Diversity &amp; Inclusion</p>
                  <p className="text-xs text-muted-foreground mb-4">Optional — only used to autofill DEI questions on applications.</p>

                  <div className="grid grid-cols-1 gap-4">
                    <FieldRow label="Gender identity">
                      <select
                        value={form.preferredPronouns}
                        onChange={(e) => { const f = { ...form, preferredPronouns: e.target.value }; setForm(f); autoSaveAppInfo(f); }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="">Prefer not to say</option>
                        <option value="man">Man</option>
                        <option value="woman">Woman</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="other">Self-describe / Other</option>
                      </select>
                    </FieldRow>

                    <FieldRow label="Race / Ethnicity">
                      <select
                        value={form.ethnicity}
                        onChange={(e) => { const f = { ...form, ethnicity: e.target.value }; setForm(f); autoSaveAppInfo(f); }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="">Prefer not to say</option>
                        <option value="asian">Asian</option>
                        <option value="black">Black or African American</option>
                        <option value="hispanic">Hispanic or Latino</option>
                        <option value="middle_eastern">Middle Eastern or North African</option>
                        <option value="native_american">Native American or Alaska Native</option>
                        <option value="pacific_islander">Native Hawaiian or Pacific Islander</option>
                        <option value="white">White</option>
                        <option value="two_or_more">Two or more races</option>
                        <option value="other">Other</option>
                      </select>
                    </FieldRow>

                    <FieldRow label="Veteran status">
                      <select
                        value={form.veteranStatus}
                        onChange={(e) => { const f = { ...form, veteranStatus: e.target.value }; setForm(f); autoSaveAppInfo(f); }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="">Prefer not to say</option>
                        <option value="not_veteran">I am not a protected veteran</option>
                        <option value="veteran">I identify as a protected veteran</option>
                      </select>
                    </FieldRow>

                    <FieldRow label="Disability status">
                      <select
                        value={form.disabilityStatus}
                        onChange={(e) => { const f = { ...form, disabilityStatus: e.target.value }; setForm(f); autoSaveAppInfo(f); }}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
                      >
                        <option value="">Prefer not to say</option>
                        <option value="no">No, I don&apos;t have a disability</option>
                        <option value="yes">Yes, I have a disability</option>
                      </select>
                    </FieldRow>
                  </div>
                </div>

              </Section>
            )}

            {/* ── Resume tab ── */}
            {activeTab === 'resume' && (
              <Section title="Resume" description="Upload your resume and we'll auto-fill your profile fields.">
                {defaultResume && defaultVersion ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3.5">
                      <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{defaultResume.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Uploaded {new Date(defaultVersion.createdAt).toLocaleDateString()}
                          {defaultVersion.fileSizeBytes ? ` · ${(Number(defaultVersion.fileSizeBytes) / 1024).toFixed(0)} KB` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadResume(defaultResume.id, defaultVersion.id, true)}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadResume(defaultResume.id, defaultVersion.id, false)}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground px-1">Want to replace it? Upload a new one below.</p>
                    <ResumeUpload key={resumeUploadKey} onParsed={(parsed) => { handleParsedResume(parsed); mutateResumes(); setResumeUploadKey((k) => k + 1); }} />
                  </div>
                ) : (
                  <ResumeUpload key={resumeUploadKey} onParsed={(parsed) => { handleParsedResume(parsed); mutateResumes(); setResumeUploadKey((k) => k + 1); }} />
                )}

                <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-2">What gets auto-filled?</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>✓ Name → Display name</span>
                    <span>✓ Email → Apply email</span>
                    <span>✓ Phone number</span>
                    <span>✓ LinkedIn URL</span>
                    <span>✓ GitHub URL</span>
                    <span>✓ Website / Portfolio</span>
                    <span>✓ Professional headline</span>
                    <span>✓ Professional summary</span>
                    <span>✓ Years of experience</span>
                    <span>✓ Work experience entries</span>
                    <span>✓ Education entries</span>
                    <span>✓ Job titles &amp; roles</span>
                    <span>✓ Skills &amp; technologies</span>
                    <span>✓ Cities &amp; locations</span>
                  </div>
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

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-foreground">Employment types</label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, dealBreakerFields: { ...form.dealBreakerFields, employmentTypes: !form.dealBreakerFields.employmentTypes } })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border',
                        form.dealBreakerFields.employmentTypes
                          ? 'bg-destructive/10 border-destructive/30 text-destructive'
                          : 'bg-muted border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                      )}
                    >
                      <Lock className="h-2.5 w-2.5" />
                      {form.dealBreakerFields.employmentTypes ? 'Deal breaker' : 'Must match?'}
                    </button>
                  </div>
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
                  {form.dealBreakerFields.employmentTypes && (
                    <p className="text-[11px] text-destructive/80">Only jobs matching these types will appear in your feed.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-foreground">Job categories</label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, dealBreakerFields: { ...form.dealBreakerFields, jobCategories: !form.dealBreakerFields.jobCategories } })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border',
                        form.dealBreakerFields.jobCategories
                          ? 'bg-destructive/10 border-destructive/30 text-destructive'
                          : 'bg-muted border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                      )}
                    >
                      <Lock className="h-2.5 w-2.5" />
                      {form.dealBreakerFields.jobCategories ? 'Deal breaker' : 'Must match?'}
                    </button>
                  </div>
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
                  {form.dealBreakerFields.jobCategories && (
                    <p className="text-[11px] text-destructive/80">Only jobs in these categories will appear in your feed.</p>
                  )}
                </div>

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
                {/* ── Suggestions from resume ── */}
                {(() => {
                  const addedLower = new Set(form.keywords.map((k) => k.toLowerCase()));
                  const pending = suggestedKeywords.filter(
                    (k) => !dismissedKeywords.has(k) && !addedLower.has(k.toLowerCase()),
                  );
                  if (pending.length === 0) return null;
                  return (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Suggested from resume</p>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, keywords: [...new Set([...f.keywords, ...pending])] }));
                            setSuggestedKeywords([]);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          Accept all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pending.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium"
                          >
                            {kw}
                            <button
                              type="button"
                              title="Add keyword"
                              onClick={() => setForm((f) => ({ ...f, keywords: [...new Set([...f.keywords, kw])] }))}
                              className="rounded-sm text-primary hover:opacity-80 transition-opacity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              title="Dismiss suggestion"
                              onClick={() => setDismissedKeywords((prev) => new Set([...prev, kw]))}
                              className="rounded-sm text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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

            {/* ── Quick Apply tab ── */}
            {activeTab === 'quickapply' && (
              <Section title="Quick Apply" description="Control how the extension auto-applies to jobs on your behalf.">
                <ToggleRow
                  label="Autofill All"
                  hint="When on, Quick Apply will automatically fill and submit applications for all ATS types. Turn off individual ATS types in Autofill Profiles."
                  checked={form.quickApplyAll}
                  onChange={(v) => setForm({ ...form, quickApplyAll: v })}
                />

                <ToggleRow
                  label="Tier 1 Companies"
                  hint="Allow Quick Apply for top-tier companies (Google, Meta, Amazon, etc). Off by default — enable only if you want fully automated applies to these companies."
                  checked={form.tier1QuickApply}
                  onChange={(v) => setForm({ ...form, tier1QuickApply: v })}
                  cautionWhenOn
                />

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-1">How Quick Apply works</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Click Quick Apply on any job → extension fills the form automatically</li>
                    <li>A cover letter is generated using your profile and the job description</li>
                    <li>If all required fields are filled, the form is submitted automatically</li>
                    <li>Unfilled required fields are saved to Autofill Profiles for you to answer</li>
                    <li>Any errors are reported in Notifications</li>
                  </ul>
                </div>

                <SaveBar saving={saving} />
              </Section>
            )}

            {/* ── Data tab ── */}
            {activeTab === 'data' && (
              <DataSection />
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

const BLANK_WORK: WorkEntry = { company: '', title: '', startDate: '', endDate: '', description: '' };
const BLANK_EDU: EducationEntry = { institution: '', degree: '', field: '', startYear: '', endYear: '' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i);

function MonthYearPicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const parts = value ? value.split(' ') : [];
  const month = parts[0] && MONTHS.includes(parts[0]) ? parts[0] : '';
  const year = parts[1] ?? '';

  function handleMonth(m: string) {
    const y = year || '';
    onChange(m && y ? `${m} ${y}` : m || y || '');
  }
  function handleYear(y: string) {
    const m = month || '';
    onChange(m && y ? `${m} ${y}` : m || y || '');
  }

  const selectCls = 'rounded-lg border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors appearance-none cursor-pointer';

  return (
    <div className="flex gap-1.5">
      <select value={month} onChange={(e) => handleMonth(e.target.value)} className={cn(selectCls, 'flex-1')}>
        <option value="">Month</option>
        {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={year} onChange={(e) => handleYear(e.target.value)} className={cn(selectCls, 'w-24')}>
        <option value="">{placeholder ?? 'Year'}</option>
        {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
  );
}

function WorkEntryCard({
  entry, index, fromResume, isCollapsed, isDescFocused,
  onToggle, onRemove, onUpdate, onDescFocus, onDescBlur,
}: {
  entry: WorkEntry; index: number; fromResume: boolean; isCollapsed: boolean; isDescFocused: boolean;
  onToggle: () => void; onRemove: () => void;
  onUpdate: (field: keyof WorkEntry, val: string) => void;
  onDescFocus: () => void; onDescBlur: () => void;
}) {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);
  const isCurrent = entry.endDate === 'Present';
  const summaryTitle = [entry.title, entry.company].filter(Boolean).join(' @ ') || `Entry ${index + 1}`;
  const cardBorder = fromResume && index === 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-card';

  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.overflow = 'hidden';
    if (isCollapsed) {
      el.style.height = '0px';
      el.style.opacity = '0';
    } else {
      el.style.height = 'auto';
      el.style.opacity = '1';
    }
    isFirstRender.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isFirstRender.current) return;
    const el = bodyRef.current;
    if (!el) return;

    if (isCollapsed) {
      const h = el.scrollHeight;
      el.style.transition = 'none';
      el.style.height = h + 'px';
      el.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'height 220ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease';
          el.style.height = '0px';
          el.style.opacity = '0';
        });
      });
    } else {
      el.style.transition = 'none';
      el.style.overflow = 'hidden';
      el.style.height = '0px';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const h = el.scrollHeight;
          el.style.transition = 'height 220ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease';
          el.style.height = h + 'px';
          el.style.opacity = '1';
          const onEnd = () => {
            el.style.height = 'auto';
            el.removeEventListener('transitionend', onEnd);
          };
          el.addEventListener('transitionend', onEnd);
        });
      });
    }
  }, [isCollapsed]);

  return (
    <div className={cn('rounded-xl border', cardBorder)}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left min-w-0 outline-none focus-visible:outline-none"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-220',
              isCollapsed && '-rotate-90',
            )}
          />
          <span className="text-sm font-medium truncate">{summaryTitle}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Body (height animated via ref) ── */}
      <div
        ref={bodyRef}
        style={{ willChange: 'height' }}
      >
        <div className="px-4 pb-4 space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Job title</label>
              <input value={entry.title} onChange={(ev) => onUpdate('title', ev.target.value)} placeholder="Software Engineer" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <CompanyInput value={entry.company} onChange={(val) => onUpdate('company', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Start date</label>
              <MonthYearPicker value={entry.startDate} onChange={(v) => onUpdate('startDate', v)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">End date</label>
              {isCurrent ? (
                <div className="flex items-center h-[38px] px-3 rounded-lg border border-input bg-background text-sm text-muted-foreground">Present</div>
              ) : (
                <MonthYearPicker value={entry.endDate} onChange={(v) => onUpdate('endDate', v)} />
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(ev) => onUpdate('endDate', ev.target.checked ? 'Present' : '')}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">I currently work here</span>
          </label>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={entry.description}
              onChange={(ev) => onUpdate('description', ev.target.value)}
              onFocus={onDescFocus}
              onBlur={onDescBlur}
              placeholder="Key responsibilities and achievements…"
              className={cn(
                'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background resize-none transition-all duration-200 ease-in-out',
                isDescFocused ? 'min-h-[9rem]' : 'min-h-[4.5rem]',
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkExperienceEditor({
  entries, fromResume, onChange, collapsed: collapsedProp, onCollapsedChange,
}: { entries: WorkEntry[]; fromResume: boolean; onChange: (e: WorkEntry[]) => void; collapsed: boolean[]; onCollapsedChange: (c: boolean[]) => void }) {
  const collapsed = React.useMemo(() => {
    const arr = [...collapsedProp];
    while (arr.length < entries.length) arr.push(false);
    return arr.slice(0, entries.length);
  }, [collapsedProp, entries.length]);
  const [descFocused, setDescFocused] = React.useState<boolean[]>(() => entries.map(() => false));

  React.useEffect(() => {
    setDescFocused((prev) => {
      const next = [...prev];
      while (next.length < entries.length) next.push(false);
      return next.slice(0, entries.length);
    });
  }, [entries.length]);

  function update(i: number, field: keyof WorkEntry, val: string) {
    const next = entries.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
    onChange(next);
  }
  function remove(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
    onCollapsedChange(collapsed.filter((_, idx) => idx !== i));
    setDescFocused((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...entries, { ...BLANK_WORK }]);
    onCollapsedChange([...collapsed, false]);
    setDescFocused((prev) => [...prev, false]);
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No work experience yet — upload a resume or add manually.</p>
      )}
      {entries.map((e, i) => (
        <WorkEntryCard
          key={i}
          entry={e}
          index={i}
          fromResume={fromResume}
          isCollapsed={collapsed[i] ?? false}
          isDescFocused={descFocused[i] ?? false}
          onToggle={() => onCollapsedChange(collapsed.map((v, idx) => idx === i ? !v : v))}
          onRemove={() => remove(i)}
          onUpdate={(field, val) => update(i, field, val)}
          onDescFocus={() => setDescFocused((prev) => prev.map((v, idx) => idx === i ? true : v))}
          onDescBlur={() => setDescFocused((prev) => prev.map((v, idx) => idx === i ? false : v))}
        />
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center mt-1">
        <Plus className="h-3.5 w-3.5" />
        Add work experience
      </button>
    </div>
  );
}

function EduEntryCard({
  entry, index, fromResume, isCollapsed, onToggle, onRemove, onUpdate,
}: {
  entry: EducationEntry; index: number; fromResume: boolean; isCollapsed: boolean;
  onToggle: () => void; onRemove: () => void;
  onUpdate: (field: keyof EducationEntry, val: string) => void;
}) {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);
  const cardBorder = fromResume && index === 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-card';
  const summaryTitle = entry.institution || `Entry ${index + 1}`;

  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.overflow = 'hidden';
    if (isCollapsed) {
      el.style.height = '0px';
      el.style.opacity = '0';
    } else {
      el.style.height = 'auto';
      el.style.opacity = '1';
    }
    isFirstRender.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isFirstRender.current) return;
    const el = bodyRef.current;
    if (!el) return;
    if (isCollapsed) {
      const h = el.scrollHeight;
      el.style.transition = 'none';
      el.style.height = h + 'px';
      el.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'height 220ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease';
          el.style.height = '0px';
          el.style.opacity = '0';
        });
      });
    } else {
      el.style.transition = 'none';
      el.style.overflow = 'hidden';
      el.style.height = '0px';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const h = el.scrollHeight;
          el.style.transition = 'height 220ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease';
          el.style.height = h + 'px';
          el.style.opacity = '1';
          const onEnd = () => { el.style.height = 'auto'; el.removeEventListener('transitionend', onEnd); };
          el.addEventListener('transitionend', onEnd);
        });
      });
    }
  }, [isCollapsed]);

  return (
    <div className={cn('rounded-xl border', cardBorder)}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left min-w-0 outline-none focus-visible:outline-none"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-220',
              isCollapsed && '-rotate-90',
            )}
          />
          <span className="text-sm font-medium truncate">{summaryTitle}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Body (height animated via ref) ── */}
      <div ref={bodyRef} style={{ willChange: 'height' }}>
        <div className="px-4 pb-4 space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Institution</label>
              <UniversityAutocomplete value={entry.institution} onChange={(val) => onUpdate('institution', val)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Degree</label>
              <input value={entry.degree} onChange={(ev) => onUpdate('degree', ev.target.value)} placeholder="Bachelor of Science" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Field of study</label>
              <input value={entry.field} onChange={(ev) => onUpdate('field', ev.target.value)} placeholder="Computer Science" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Start year</label>
              <input value={entry.startYear} onChange={(ev) => onUpdate('startYear', ev.target.value)} placeholder="2018" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Graduation year</label>
              <input value={entry.endYear} onChange={(ev) => onUpdate('endYear', ev.target.value)} placeholder="2022" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EducationEditor({
  entries, fromResume, onChange, collapsed: collapsedProp, onCollapsedChange,
}: { entries: EducationEntry[]; fromResume: boolean; onChange: (e: EducationEntry[]) => void; collapsed: boolean[]; onCollapsedChange: (c: boolean[]) => void }) {
  const collapsed = React.useMemo(() => {
    const arr = [...collapsedProp];
    while (arr.length < entries.length) arr.push(false);
    return arr.slice(0, entries.length);
  }, [collapsedProp, entries.length]);

  function update(i: number, field: keyof EducationEntry, val: string) {
    const next = entries.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
    onChange(next);
  }
  function remove(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
    onCollapsedChange(collapsed.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...entries, { ...BLANK_EDU }]);
    onCollapsedChange([...collapsed, false]);
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No education yet — upload a resume or add manually.</p>
      )}
      {entries.map((e, i) => (
        <EduEntryCard
          key={i}
          entry={e}
          index={i}
          fromResume={fromResume}
          isCollapsed={collapsed[i] ?? false}
          onToggle={() => onCollapsedChange(collapsed.map((v, idx) => idx === i ? !v : v))}
          onRemove={() => remove(i)}
          onUpdate={(field, val) => update(i, field, val)}
        />
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center mt-1">
        <Plus className="h-3.5 w-3.5" />
        Add education
      </button>
    </div>
  );
}

function Section({ title, description, children, headerRight }: { title: string; description: string; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {headerRight && <div>{headerRight}</div>}
        </div>
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

function ToggleRow({
  label, hint, checked, onChange, cautionWhenOn,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  cautionWhenOn?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-start justify-between gap-4 rounded-xl border p-4 transition-colors',
      cautionWhenOn && checked
        ? 'border-amber-400/40 bg-amber-50/40 dark:bg-amber-900/10'
        : 'border-border bg-background',
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          checked
            ? cautionWhenOn ? 'bg-amber-500' : 'bg-primary'
            : 'bg-muted-foreground/30',
        )}
      >
        <span className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )} />
      </button>
    </div>
  );
}

interface LinkedInQueriesResponse {
  maxQueries: number;
  active: number;
  queries: { keywords: string; jobType: string; defaultCategory: string }[];
}

function DataSection() {
  const { data, mutate: mutateStatus } = useSWR<{ lastFetchedAt: string | null }>(
    '/api/admin/refresh-status',
    (url: string) => api.get<{ lastFetchedAt: string | null }>(url),
    { refreshInterval: 60000 },
  );
  const { data: liQueries } = useSWR<LinkedInQueriesResponse>(
    '/api/admin/linkedin-queries',
    (url: string) => api.get<LinkedInQueriesResponse>(url),
  );
  const [refreshing, setRefreshing] = React.useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await api.post('/api/admin/refresh', {});
      await mutateStatus();
      toast({ title: 'Jobs refreshed', description: 'Job board has been updated with the latest listings.' });
    } catch {
      toast({ title: 'Refresh failed', description: 'Could not refresh jobs. Try again shortly.', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  }


  function formatLastFetched(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return new Date(iso).toLocaleDateString();
  }

  const fullTimeQueries = liQueries?.queries.filter((q) => !q.jobType) ?? [];
  const internQueries = liQueries?.queries.filter((q) => !!q.jobType) ?? [];

  return (
    <Section title="Data" description="Control when job listings are fetched and refreshed.">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Job Board</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last refreshed: <span className="font-medium text-foreground">{formatLastFetched(data?.lastFetchedAt)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Auto-refreshes every 15 minutes.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5 shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh Now'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
              LinkedIn Search Queries
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {liQueries ? `${liQueries.active} active queries · capped at ${liQueries.maxQueries} max to avoid rate limits` : 'Loading…'}
            </p>
          </div>
        </div>

        {liQueries && (
          <div className="space-y-3">
            {fullTimeQueries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Full-time</p>
                <div className="flex flex-wrap gap-1.5">
                  {fullTimeQueries.map((q) => (
                    <span
                      key={q.keywords}
                      className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {q.keywords}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {internQueries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Intern &amp; Co-op</p>
                <div className="flex flex-wrap gap-1.5">
                  {internQueries.map((q) => (
                    <span
                      key={q.keywords}
                      className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400"
                    >
                      {q.keywords}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
