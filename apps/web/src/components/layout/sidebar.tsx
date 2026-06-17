'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Star,
  Send,
  Settings,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'applyme:sidebar-collapsed';

const NAV_ITEMS = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/applications', label: 'Applied', icon: Send },
  { href: '/autofill-profiles', label: 'Autofill Profiles', icon: Layers },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

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

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-border bg-card py-4 transition-[width] duration-200',
        collapsed ? 'w-16 items-center' : 'w-60 px-3',
      )}
    >
      <div className={cn('mb-6', !collapsed && 'px-2')}>
        {collapsed ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary"
            aria-hidden
          >
            A
          </span>
        ) : (
          <div className="min-w-0">
            <span className="text-lg font-semibold tracking-tight">ApplyMe</span>
            <span className="ml-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider">
              CA
            </span>
          </div>
        )}
      </div>

      <nav className="flex w-full flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={cn(
                'group relative flex items-center rounded-md text-sm transition-colors',
                collapsed ? 'mx-auto h-9 w-9 shrink-0 justify-center p-0' : 'gap-3 px-3 py-2',
                active
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-accent"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4 shrink-0" />
              {!collapsed && <span className="relative z-10">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          'mt-4 w-full border-t border-border pt-4',
          collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between px-2',
        )}
      >
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="shrink-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
