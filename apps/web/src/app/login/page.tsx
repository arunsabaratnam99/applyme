'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Loader2, Briefcase, DollarSign, X } from 'lucide-react';
import { ResumeUpload, type ParsedResume } from '@/components/settings/ResumeUpload';
import { api } from '@/lib/api';

declare const process: { env: Record<string, string | undefined> };
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8787';

// ── Mocha palette (matches globals.css .dark vars) ──────────────
const M = {
  bg:          '#1c1814',   // --background dark mocha
  card:        '#221e1a',   // --card dark mocha
  border:      '#2e2822',   // --border dark mocha
  primary:     '#c4a882',   // --primary dark mocha (warm sand)
  primaryDim:  '#a08a68',
  muted:       '#4a4540',   // muted-foreground ish
  inputBg:     '#262018',
  glow:        'rgba(180,140,90,0.22)',
  glowOuter:   'rgba(130,90,40,0.10)',
};

const STEPS = [
  { n: 1, label: 'Sign in to your account' },
  { n: 2, label: 'Upload your resume' },
  { n: 3, label: 'Your profile & preferences' },
];

const VISA_OPTIONS = [
  { value: 'citizen',     label: 'Canadian Citizen / PR' },
  { value: 'student',     label: 'Student / Study Permit' },
  { value: 'work_permit', label: 'Open Work Permit' },
  { value: 'sponsorship', label: 'Requires Sponsorship' },
];

const PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland & Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

const SUGGESTED_ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Mobile Developer', 'Data Engineer',
  'Data Scientist', 'ML Engineer', 'DevOps Engineer', 'Cloud Engineer',
  'Product Manager', 'UX Designer', 'QA Engineer', 'Security Engineer',
  'Site Reliability Engineer', 'Solutions Architect',
  'Software Engineer Intern', 'Software Developer Intern', 'Data Science Intern',
  'Frontend Intern', 'Backend Intern', 'Product Manager Intern',
];

/* ── shared input class ───────────────────────────────────── */
const inputCls = `w-full rounded-xl border px-4 py-3 text-sm text-[#e8e0d5] placeholder:text-[#6b6158] focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all`;
const inputStyle = {
  background: M.inputBg,
  borderColor: M.border,
};
const inputFocused = {
  borderColor: M.primary,
  boxShadow: `0 0 0 2px ${M.primary}33`,
};
const inputFocusStyle = {} as React.CSSProperties;

function FocusInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={{ ...inputStyle, ...(focused ? inputFocused : {}), ...props.style }}
    />
  );
}

function FocusSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <select
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={{ ...inputStyle, ...(focused ? inputFocused : {}), ...props.style }}
    />
  );
}

/* ── RoleTagInput ──────────────────────────────────────────── */
function RoleTagInput({ tags, onChange, resumeTags }: {
  tags: string[];
  onChange: (v: string[]) => void;
  resumeTags: string[];
}) {
  const [input, setInput] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = SUGGESTED_ROLES.filter(
    (r) => r.toLowerCase().includes(input.toLowerCase()) && !tags.includes(r),
  );

  function addTag(val: string) {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
    setOpen(false);
  }

  function removeTag(t: string) { onChange(tags.filter((x) => x !== t)); }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const resumeTagSet = new Set(resumeTags);
  const resumeInTags = tags.filter((t) => resumeTagSet.has(t));
  const manualTags   = tags.filter((t) => !resumeTagSet.has(t));

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        style={{ background: M.inputBg, borderColor: open ? M.primary : M.border, boxShadow: open ? `0 0 0 2px ${M.primary}33` : 'none' }}
        className="flex flex-wrap gap-1.5 min-h-[48px] w-full rounded-xl border px-3 py-2.5 cursor-text transition-all duration-150"
      >
        {/* AI-detected tags */}
        {resumeInTags.map((t) => (
          <span
            key={t}
            style={{ background: M.primary + '22', borderColor: M.primary + '55', color: M.primary }}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-medium"
          >
            <span style={{ color: M.primary }} className="text-[9px] font-bold uppercase tracking-wider opacity-70">AI</span>
            {t}
            <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(t); }} className="ml-0.5 opacity-60 hover:opacity-100">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {/* Manually added tags */}
        {manualTags.map((t) => (
          <span
            key={t}
            style={{ background: M.card, borderColor: M.border, color: '#e8e0d5' }}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-medium"
          >
            {t}
            <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(t); }} className="ml-0.5 opacity-50 hover:opacity-100">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={tags.length === 0 ? 'e.g. Software Engineer, Backend Developer…' : ''}
          style={{ caretColor: M.primary }}
          className="flex-1 min-w-[140px] bg-transparent outline-none focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm text-[#e8e0d5] placeholder:text-[#6b6158]"
        />
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div
          style={{ background: M.card, borderColor: M.border }}
          className="absolute z-50 mt-1 w-full rounded-xl border shadow-xl overflow-hidden"
        >
          <div className="max-h-44 overflow-y-auto py-1">
            {filtered.slice(0, 8).map((r) => (
              <button
                key={r}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(r); }}
                style={{ color: '#e8e0d5' }}
                className="flex w-full items-center px-4 py-2 text-sm transition-colors hover:bg-white/5 text-left"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-1.5 text-[11px]" style={{ color: M.muted }}>
        Press Enter after each role.{' '}
        <span style={{ color: M.primary }}>Sand-highlighted</span> = AI-detected from resume.
      </p>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────── */
function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = React.useState(() =>
    Math.min(3, Math.max(1, Number(searchParams.get('step') ?? 1))),
  );
  const [animating, setAnimating] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

  // Sync step when URL changes (e.g. auth guard redirects /login?step=2)
  React.useEffect(() => {
    const urlStep = Math.min(3, Math.max(1, Number(searchParams.get('step') ?? 1)));
    if (urlStep !== step && !animating) {
      setVisible(false);
      setTimeout(() => { setStep(urlStep); setVisible(true); }, 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Profile state (auto-filled from resume)
  const [firstName, setFirstName] = React.useState('');
  const [lastName,  setLastName]  = React.useState('');
  const [city,      setCity]      = React.useState('');
  const [province,  setProvince]  = React.useState('ON');
  const [visaAuth,  setVisaAuth]  = React.useState('citizen');
  const [roles,     setRoles]     = React.useState<string[]>([]);
  const [resumeRoles, setResumeRoles] = React.useState<string[]>([]);
  const [preferredRemote, setPreferredRemote] = React.useState(false);
  const [employmentTypes, setEmploymentTypes] = React.useState<string[]>(['full_time']);
  const [salaryMin, setSalaryMin] = React.useState('');
  const [salaryMax, setSalaryMax] = React.useState('');
  const [salaryType, setSalaryType] = React.useState<'annual' | 'hourly'>('annual');
  const [saving, setSaving] = React.useState(false);

  function goTo(next: number) {
    if (animating) return;
    setAnimating(true);
    setVisible(false);
    setTimeout(() => {
      setStep(next); setVisible(true); setAnimating(false);
      router.replace(`/login?step=${next}`);
    }, 200);
  }

  function handleResumeParsed(parsed: ParsedResume) {
    if (parsed.roles?.length) {
      setRoles((prev) => Array.from(new Set([...prev, ...(parsed.roles ?? [])])));
      setResumeRoles(parsed.roles ?? []);
    }
    if (parsed.displayName && !firstName && !lastName) {
      const parts = parsed.displayName.trim().split(' ');
      setFirstName(parts[0] ?? '');
      setLastName(parts.slice(1).join(' '));
    }
    if (parsed.locations?.length && !city) {
      const loc = parsed.locations[0] ?? '';
      const commaSplit = loc.split(',');
      setCity((commaSplit[0] ?? loc).trim());
    }
    // Auto-advance to step 3
    goTo(3);
  }

  async function finishOnboarding() {
    setSaving(true);
    const displayName = [firstName, lastName].filter(Boolean).join(' ');
    const location    = city ? `${city}, ${province}` : '';
    try {
      await api.put('/api/profile', {
        displayName: displayName || undefined,
        locations: location ? [location] : [],
        visaAuth, roles, preferredRemote, employmentTypes,
        salaryMin: salaryMin ? Number(salaryMin) : null,
        salaryMax: salaryMax ? Number(salaryMax) : null,
      });
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
    router.push('/jobs');
  }

  function toggleEmploymentType(val: string) {
    setEmploymentTypes((prev) =>
      prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val],
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: M.bg }}>

      {/* ── Left panel ─────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[44%] flex-col justify-between p-10 overflow-hidden">
        {/* Warm glow blob */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 20%, ${M.glow} 0%, ${M.glowOuter} 50%, transparent 75%)`,
        }} />
        {/* Noise texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full flex items-center justify-center ring-1" style={{ background: M.primary + '22', borderColor: M.primary + '55' }}>
            <span className="text-xs font-bold" style={{ color: M.primary }}>A</span>
          </div>
          <span className="font-semibold text-lg tracking-tight" style={{ color: '#e8e0d5' }}>ApplyMe</span>
        </div>

        {/* Copy + step progress */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-snug" style={{ color: '#e8e0d5' }}>
              Get Started<br />with ApplyMe
            </h2>
            <p className="mt-3 text-sm leading-relaxed max-w-xs" style={{ color: M.muted }}>
              Canada&apos;s job matcher &amp; assisted apply platform for software and business roles.
            </p>
          </div>

          <div className="space-y-2.5">
            {STEPS.map((s) => {
              const done   = step > s.n;
              const active = step === s.n;
              return (
                <div
                  key={s.n}
                  className="flex items-center gap-3.5 rounded-xl px-4 py-3 transition-all duration-300"
                  style={{ background: active ? M.primary + '18' : 'transparent', border: active ? `1px solid ${M.primary}33` : '1px solid transparent' }}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300"
                    style={{
                      background: done ? M.primary : active ? M.primary : M.border,
                      color:      done ? M.bg      : active ? M.bg      : M.muted,
                    }}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
                  </div>
                  <span
                    className="text-sm font-medium transition-colors duration-300"
                    style={{ color: active ? '#e8e0d5' : done ? '#9a8f83' : '#5a534d' }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: '#4a4540' }}>
          © {new Date().getFullYear()} ApplyMe. We never apply without your approval.
        </p>
      </div>

      {/* ── Right panel ────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-full flex items-center justify-center ring-1" style={{ background: M.primary + '22', borderColor: M.primary + '55' }}>
              <span className="text-xs font-bold" style={{ color: M.primary }}>A</span>
            </div>
            <span className="font-semibold text-base" style={{ color: '#e8e0d5' }}>ApplyMe</span>
          </div>

          {/* Animated content */}
          <div
            className="transition-all duration-200"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}
          >
            {step === 1 && <StepSignIn />}
            {step === 2 && <StepResume onParsed={handleResumeParsed} onSkip={() => goTo(3)} />}
            {step === 3 && (
              <StepProfile
                firstName={firstName} setFirstName={setFirstName}
                lastName={lastName}   setLastName={setLastName}
                city={city}           setCity={setCity}
                province={province}   setProvince={setProvince}
                visaAuth={visaAuth}   setVisaAuth={setVisaAuth}
                roles={roles}         setRoles={setRoles}
                resumeRoles={resumeRoles}
                preferredRemote={preferredRemote} setPreferredRemote={setPreferredRemote}
                employmentTypes={employmentTypes} toggleEmploymentType={toggleEmploymentType}
                salaryMin={salaryMin} setSalaryMin={setSalaryMin}
                salaryMax={salaryMax} setSalaryMax={setSalaryMax}
                salaryType={salaryType} setSalaryType={setSalaryType}
                saving={saving}
                onFinish={finishOnboarding}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Sign In ──────────────────────────────────────── */
function StepSignIn() {
  const btnCls = `flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3.5 text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99]`;
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: M.primary }}>Step 1 of 3</p>
        <h1 className="text-2xl font-bold" style={{ color: '#e8e0d5' }}>Sign in to your account</h1>
        <p className="mt-1.5 text-sm" style={{ color: M.muted }}>Choose a provider to continue. No password required.</p>
      </div>

      <div className="space-y-3">
        <a href={`${API_BASE}/auth/google`} className={btnCls} style={{ borderColor: M.border, background: M.card, color: '#e8e0d5' }}>
          <GoogleIcon /> Continue with Google
        </a>
        <a href={`${API_BASE}/auth/github`} className={btnCls} style={{ borderColor: M.border, background: M.card, color: '#e8e0d5' }}>
          <GithubIcon /> Continue with GitHub
        </a>
      </div>

      <p className="text-center text-xs" style={{ color: '#4a4540' }}>
        By signing in you agree to our Privacy Policy.<br />
        We never apply on your behalf without your approval.
      </p>
    </div>
  );
}

/* ─── Step 2: Resume Upload ────────────────────────────────── */
function StepResume({ onParsed, onSkip }: { onParsed: (p: ParsedResume) => void; onSkip: () => void }) {
  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: M.primary }}>Step 2 of 3</p>
        <h1 className="text-2xl font-bold" style={{ color: '#e8e0d5' }}>Upload your resume</h1>
        <p className="mt-1.5 text-sm" style={{ color: M.muted }}>
          We&apos;ll auto-fill your profile from it. Skip to fill manually.
        </p>
      </div>

      <div
        className="[&_.border-dashed]:transition-colors"
        style={{
          ['--resume-border' as string]: M.border,
          ['--resume-bg' as string]: M.inputBg,
        }}
      >
        <ResumeUpload onParsed={onParsed} />
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-sm text-center transition-colors"
        style={{ color: M.muted }}
        onMouseEnter={(e) => (e.currentTarget.style.color = M.primary)}
        onMouseLeave={(e) => (e.currentTarget.style.color = M.muted)}
      >
        Skip for now — fill profile manually
      </button>
    </div>
  );
}

/* ─── Step 3: Profile & Preferences ───────────────────────── */
function StepProfile({
  firstName, setFirstName, lastName, setLastName,
  city, setCity, province, setProvince,
  visaAuth, setVisaAuth,
  roles, setRoles, resumeRoles,
  preferredRemote, setPreferredRemote,
  employmentTypes, toggleEmploymentType,
  salaryMin, setSalaryMin, salaryMax, setSalaryMax,
  salaryType, setSalaryType,
  saving, onFinish,
}: {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string;  setLastName:  (v: string) => void;
  city: string;      setCity:      (v: string) => void;
  province: string;  setProvince:  (v: string) => void;
  visaAuth: string;  setVisaAuth:  (v: string) => void;
  roles: string[];   setRoles:     (v: string[]) => void;
  resumeRoles: string[];
  preferredRemote: boolean; setPreferredRemote: (v: boolean) => void;
  employmentTypes: string[]; toggleEmploymentType: (v: string) => void;
  salaryMin: string; setSalaryMin: (v: string) => void;
  salaryMax: string; setSalaryMax: (v: string) => void;
  salaryType: 'annual' | 'hourly'; setSalaryType: (v: 'annual' | 'hourly') => void;
  saving: boolean; onFinish: () => void;
}) {
  const EMP_TYPES = [
    { value: 'full_time',   label: 'Full-time' },
    { value: 'internship',  label: 'Internship' },
    { value: 'co_op',       label: 'Co-op' },
    { value: 'contract',    label: 'Contract' },
  ];

  const labelCls = 'text-xs font-medium uppercase tracking-wide block mb-2';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: M.primary }}>Step 3 of 3</p>
        <h1 className="text-2xl font-bold" style={{ color: '#e8e0d5' }}>Your profile &amp; preferences</h1>
        <p className="mt-1.5 text-sm" style={{ color: M.muted }}>Confirm or edit your info — fields are pre-filled from your resume.</p>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} style={{ color: '#9a8f83' }}>First Name</label>
          <FocusInput
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Arun"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: '#9a8f83' }}>Last Name</label>
          <FocusInput
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Sabaratnam"
            className={inputCls}
          />
        </div>
      </div>

      {/* Location row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} style={{ color: '#9a8f83' }}>City</label>
          <FocusInput
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Toronto"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: '#9a8f83' }}>Province</label>
          <FocusSelect
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className={inputCls + ' appearance-none'}
          >
            {PROVINCES.map((p) => (
              <option key={p.value} value={p.value} style={{ background: M.card }}>{p.label}</option>
            ))}
          </FocusSelect>
        </div>
      </div>

      {/* Work authorization */}
      <div>
        <label className={labelCls} style={{ color: '#9a8f83' }}>Work Authorization</label>
        <FocusSelect
          value={visaAuth}
          onChange={(e) => setVisaAuth(e.target.value)}
          className={inputCls + ' appearance-none'}
        >
          {VISA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} style={{ background: M.card }}>{o.label}</option>
          ))}
        </FocusSelect>
      </div>

      {/* Target roles */}
      <div>
        <label className={labelCls + ' flex items-center gap-1.5'} style={{ color: '#9a8f83' }}>
          <Briefcase className="h-3 w-3" /> Target Roles
        </label>
        <RoleTagInput tags={roles} onChange={setRoles} resumeTags={resumeRoles} />
      </div>

      {/* Employment type */}
      <div>
        <label className={labelCls} style={{ color: '#9a8f83' }}>Employment Type</label>
        <div className="flex flex-wrap gap-2">
          {EMP_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleEmploymentType(t.value)}
              className="rounded-lg px-3.5 py-2 text-xs font-medium transition-all"
              style={employmentTypes.includes(t.value)
                ? { background: M.primary + '33', color: M.primary, border: `1px solid ${M.primary}66` }
                : { background: M.inputBg, color: '#9a8f83', border: `1px solid ${M.border}` }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Remote toggle */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3.5"
        style={{ background: M.inputBg, border: `1px solid ${M.border}` }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: '#e8e0d5' }}>Open to remote</p>
          <p className="text-xs mt-0.5" style={{ color: M.muted }}>Include remote-only jobs in your matches</p>
        </div>
        <button
          type="button"
          onClick={() => setPreferredRemote(!preferredRemote)}
          className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
          style={{ background: preferredRemote ? M.primary : M.border }}
        >
          <span
            className="inline-block h-5 w-5 transform rounded-full shadow transition-transform duration-200 mt-0.5"
            style={{ background: preferredRemote ? M.bg : '#e8e0d5', transform: `translateX(${preferredRemote ? '20px' : '2px'})` }}
          />
        </button>
      </div>

      {/* Salary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls + ' flex items-center gap-1.5 mb-0'} style={{ color: '#9a8f83' }}>
            <DollarSign className="h-3 w-3" /> Salary (optional)
          </label>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: M.border }}>
            {(['annual', 'hourly'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSalaryType(t)}
                className="px-3 py-1 text-[11px] font-medium transition-colors"
                style={salaryType === t
                  ? { background: M.primary + '33', color: M.primary }
                  : { background: M.inputBg, color: '#9a8f83' }}
              >
                {t === 'annual' ? 'Annual' : 'Hourly'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <FocusInput
            type="number"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder={salaryType === 'annual' ? 'Min e.g. 80000' : 'Min e.g. 25'}
            className={inputCls}
          />
          <FocusInput
            type="number"
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            placeholder={salaryType === 'annual' ? 'Max e.g. 130000' : 'Max e.g. 60'}
            className={inputCls}
          />
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: M.muted }}>
          {salaryType === 'annual' ? 'CAD per year' : 'CAD per hour'}
        </p>
      </div>

      <button
        onClick={onFinish}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: M.primary, color: M.bg }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Finish setup — Go to jobs <ChevronRight className="h-4 w-4" /></>}
      </button>
    </div>
  );
}

/* ─── Icons ────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" style={{ fill: '#e8e0d5' }}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" style={{ background: M.bg }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: M.primary }} /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
