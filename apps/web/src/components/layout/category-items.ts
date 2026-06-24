import type { CategoryItem } from './category-top-bar';

/**
 * Shared list of top-level peer categories rendered in the centered top bar
 * on /jobs and /internships. Keep this list short — it's the Perplexity-style
 * primary navigation between same-tier surfaces.
 */
export const TOP_CATEGORIES: readonly CategoryItem[] = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/internships', label: 'Internships' },
];
