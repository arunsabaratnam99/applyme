'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Star,
  Send,
  FileText,
  Bell,
  Settings,
  Layers,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/layout/theme-toggle';

const NAV_ITEMS = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/matches', label: 'Matches', icon: Zap },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/applications', label: 'Applied', icon: Send },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/queue', label: 'Autofill Queue', icon: Layers },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-lg font-semibold tracking-tight">ApplyMe</span>
        <span className="ml-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider">CA</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
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
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 px-2">
        <ThemeToggle />
      </div>
    </aside>
  );
}
