'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import {
  Settings as SettingsIcon,
  Moon,
  HelpCircle,
  LogOut,
  ChevronRight,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/cn';

interface MeData {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

/** Perplexity-style profile chip + popover menu. */
export function UserMenu({
  me,
  collapsed,
}: {
  me: MeData | null;
  collapsed: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [appearanceOpen, setAppearanceOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSignOut() {
    try {
      await api.post('/auth/logout');
    } catch {
      toast({ title: 'Failed to sign out', variant: 'destructive' });
      return;
    }
    document.cookie = 'am_session=; path=/; max-age=0';
    window.location.href = '/login';
  }

  const name = me?.name ?? me?.email ?? 'User';
  const initial = (me?.name ?? me?.email ?? 'U').charAt(0).toUpperCase();

  const Avatar = (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-primary/20"
      aria-hidden
    >
      {me?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );

  const themeLabel =
    theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? name : undefined}
        aria-label="Open user menu"
        aria-expanded={open}
        className={cn(
          'group flex w-full items-center rounded-md transition-colors hover:bg-accent',
          collapsed ? 'h-9 w-9 justify-center p-0' : 'gap-2 px-2 py-1.5',
        )}
      >
        {Avatar}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
              {name}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 w-64 rounded-xl border border-border bg-popover p-1 shadow-xl',
            collapsed ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 mb-2',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            {Avatar}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me?.name ?? 'User'}</p>
              {me?.email && (
                <p className="truncate text-xs text-muted-foreground">{me.email}</p>
              )}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />

          {/* All settings */}
          <MenuItem
            icon={<SettingsIcon className="h-4 w-4" />}
            label="All settings"
            onClick={() => {
              setOpen(false);
              router.push('/settings');
            }}
          />

          {/* Appearance with submenu */}
          <div className="relative">
            <MenuItem
              icon={<Moon className="h-4 w-4" />}
              label="Appearance"
              hint={themeLabel}
              trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={() => setAppearanceOpen((v) => !v)}
            />
            {appearanceOpen && (
              <div className="absolute left-full top-0 ml-1 w-44 rounded-xl border border-border bg-popover p-1 shadow-xl">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setTheme(t);
                      setAppearanceOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="capitalize">{t}</span>
                    {theme === t && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Help */}
          <MenuItem
            icon={<HelpCircle className="h-4 w-4" />}
            label="Help"
            onClick={() => {
              setOpen(false);
              window.open('mailto:support@applyme.app', '_blank');
            }}
          />

          <div className="my-1 h-px bg-border" />

          {/* Sign out */}
          <MenuItem
            icon={<LogOut className="h-4 w-4" />}
            label="Sign out"
            onClick={handleSignOut}
            destructive
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  trailing,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        destructive
          ? 'text-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-foreground hover:bg-accent',
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {trailing}
    </button>
  );
}
