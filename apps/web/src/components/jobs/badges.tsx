import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { SOURCE_META } from './types';

export function EmploymentBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' }> = {
    full_time:  { label: 'Full-time',  variant: 'secondary' },
    part_time:  { label: 'Part-time',  variant: 'secondary' },
    internship: { label: 'Internship', variant: 'warning' },
    co_op:      { label: 'Co-op',      variant: 'warning' },
    contract:   { label: 'Contract',   variant: 'secondary' },
  };
  const cfg = map[type] ?? { label: type, variant: 'secondary' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function WorkplaceBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const map: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };
  return <Badge variant="outline">{map[type] ?? type}</Badge>;
}

export function SourceBadge({ source, href }: { source: string; href?: string }) {
  const meta = SOURCE_META[source?.toLowerCase()] ?? { label: source, color: 'text-muted-foreground' };
  const inner = (
    <>
      <Radio className="h-2.5 w-2.5" />
      {meta.label}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn('flex items-center gap-1 font-medium shrink-0 hover:underline', meta.color)}
      >
        {inner}
      </a>
    );
  }
  return (
    <span className={cn('flex items-center gap-1 font-medium shrink-0', meta.color)}>
      {inner}
    </span>
  );
}
