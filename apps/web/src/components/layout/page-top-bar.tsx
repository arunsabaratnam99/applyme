'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export interface PageTopBarTab {
  id: string;
  label: string;
}

/**
 * In-page top bar: title on the left, segmented tabs absolutely-centered.
 * The bar is intentionally minimal — nothing else ever appears in it.
 */
export function PageTopBar({
  title,
  tabs,
  activeTab,
  onTabChange,
}: {
  title: React.ReactNode;
  tabs: PageTopBarTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="relative flex h-14 items-center px-5">
        <div className="text-base font-semibold text-foreground">
          {title}
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <nav className="pointer-events-auto flex items-center gap-1">
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'relative inline-flex items-center px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="relative">
                    {tab.label}
                    {active && (
                      <motion.span
                        layoutId="page-top-bar-underline"
                        className="absolute left-0 right-0 -bottom-[14px] h-[2px] rounded-full bg-foreground"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
