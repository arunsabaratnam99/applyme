'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

export interface CategoryItem {
  href: string;
  label: string;
}

/**
 * Perplexity-style centered peer-category nav bar. Lives inside a page's main
 * column, not the global layout — pages opt-in by rendering it at the top of
 * their tree.
 */
export function CategoryTopBar({
  items,
  activeHref,
}: {
  items: readonly CategoryItem[];
  activeHref: string;
}) {
  return (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative flex h-12 items-center justify-center border-b border-border px-4">
        <nav className="flex items-center gap-1">
          {items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                // typed-routes wants a Route literal; we know these are valid app routes.
                href={item.href as unknown as never}
                className={cn(
                  'relative inline-flex items-center px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative">
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="category-top-bar-underline"
                      className="absolute left-0 right-0 -bottom-[14px] h-[2px] rounded-full bg-foreground"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
