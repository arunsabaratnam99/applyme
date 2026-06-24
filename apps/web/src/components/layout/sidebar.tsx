'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Briefcase,
  GraduationCap,
  Star,
  Send,
  Layers,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import useSWR from 'swr';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/layout/user-menu';

const STORAGE_KEY = 'applyme:sidebar-collapsed';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/internships', label: 'Internships', icon: GraduationCap },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/applications', label: 'Applied', icon: Send },
];

const SECONDARY_NAV: readonly NavItem[] = [
  { href: '/autofill-profiles', label: 'Autofill Profiles', icon: Layers },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

interface MeData {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setCollapsed(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const { data: me } = useSWR<MeData>(
    '/api/profile/me',
    (url: string) => api.get<MeData>(url),
  );

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200',
        collapsed ? 'w-14 items-center px-1.5 py-3' : 'w-52 px-2 py-3',
      )}
    >
      {/* ── Logo + collapse toggle ─────────────────────────────── */}
      <div
        className={cn(
          'mb-4 flex items-center',
          collapsed ? 'flex-col gap-2' : 'justify-between px-1',
        )}
      >
        <Link
          href="/jobs"
          aria-label="ApplyMe home"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary"
        >
          A
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="flex w-full flex-1 flex-col gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}

        {!collapsed && <div className="mt-3 mb-1 h-px bg-border/60" />}
        {collapsed && <div className="my-2 h-px w-6 bg-border/60" />}

        {SECONDARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
            muted
          />
        ))}
      </nav>

      {/* ── User menu ───────────────────────────────────────────── */}
      <div
        className={cn(
          'mt-2 border-t border-border pt-2',
          collapsed ? 'flex w-full justify-center' : 'w-full',
        )}
      >
        <UserMenu me={me ?? null} collapsed={collapsed} />
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLink({
  item,
  active,
  collapsed,
  muted,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  muted?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href as unknown as never}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center rounded-md text-sm transition-colors',
        collapsed ? 'mx-auto h-9 w-9 justify-center p-0' : 'gap-2.5 px-2.5 py-1.5',
        active
          ? 'text-foreground font-medium'
          : muted
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-md bg-accent"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
        />
      )}
      <Icon className={cn('relative z-10 shrink-0', muted ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
    </Link>
  );
}
