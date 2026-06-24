'use client';

import React from 'react';
import useSWR from 'swr';
import { Plus, Trash2, Star, Search, X, Github, ExternalLink, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/cn';

interface SourceRow {
  id: string;
  owner: string;
  repo: string;
  label: string | null;
  isInternship: boolean;
  enabled: boolean;
  builtIn: boolean;
  createdAt: string | null;
}

interface SourcesResponse {
  sources: SourceRow[];
}

interface SearchHit {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  htmlUrl: string;
  pushedAt: string;
}

export function SourcesView() {
  const [addRepoOpen, setAddRepoOpen] = React.useState(false);
  const { data, isLoading, mutate } = useSWR<SourcesResponse>(
    '/api/internship-sources',
    (url: string) => api.get<SourcesResponse>(url),
  );

  const sources = data?.sources ?? [];
  const builtIn = sources.filter((s) => s.builtIn);
  const custom = sources.filter((s) => !s.builtIn);

  async function handleDelete(id: string) {
    if (!confirm('Remove this source repository?')) return;
    try {
      await api.delete(`/api/internship-sources/${id}`);
      await mutate();
      toast({ title: 'Repository removed' });
    } catch {
      toast({ title: 'Failed to remove repository', variant: 'destructive' });
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          ApplyMe pulls internship listings from these GitHub repositories every 15 minutes.
          Add your own to track listings from other community-curated sources.
        </p>
        <Button onClick={() => setAddRepoOpen(true)} size="sm" className="shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add repo
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {custom.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your repositories
              </h2>
              <div className="space-y-2">
                {custom.map((s) => (
                  <SourceRowItem key={s.id} source={s} onDelete={() => handleDelete(s.id)} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Built-in repositories
            </h2>
            <div className="space-y-2">
              {builtIn.map((s) => (
                <SourceRowItem key={s.id} source={s} />
              ))}
            </div>
          </section>
        </div>
      )}

      {addRepoOpen && (
        <AddRepoModal
          onClose={() => setAddRepoOpen(false)}
          onAdded={() => {
            setAddRepoOpen(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function SourceRowItem({ source, onDelete }: { source: SourceRow; onDelete?: () => void }) {
  const href = `https://github.com/${source.owner}/${source.repo}`;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Github className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground truncate hover:underline"
          >
            {source.owner}/{source.repo}
          </a>
          {source.builtIn && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Built-in
            </span>
          )}
          {source.isInternship ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Internship
            </span>
          ) : (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              New Grad
            </span>
          )}
        </div>
        {source.label && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{source.label}</p>
        )}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="Open on GitHub"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {onDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

type AddRepoTab = 'search' | 'paste';

function AddRepoModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = React.useState<AddRepoTab>('search');

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-popover-in">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">Add source repository</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pull internship listings from a GitHub repo with a parseable README or listings.json.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex border-b border-border px-5">
            <TabButton active={tab === 'search'} onClick={() => setTab('search')}>Search GitHub</TabButton>
            <TabButton active={tab === 'paste'} onClick={() => setTab('paste')}>Paste URL</TabButton>
          </div>

          <div className="p-5">
            {tab === 'search' && <SearchTab onAdded={onAdded} />}
            {tab === 'paste' && <PasteTab onAdded={onAdded} />}
          </div>
        </div>
      </div>
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative -mb-px px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-b-2 border-foreground text-foreground'
          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function SearchTab({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = React.useState('');
  const [debouncedQ, setDebouncedQ] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useSWR<{ items: SearchHit[] }>(
    debouncedQ ? `/api/internship-sources/search?q=${encodeURIComponent(debouncedQ)}` : null,
    (url: string) => api.get<{ items: SearchHit[] }>(url),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search GitHub repos (e.g. 'summer 2026 internships')"
          className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="max-h-[360px] overflow-y-auto space-y-1.5">
        {!debouncedQ && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            Start typing to search GitHub for internship repositories.
          </p>
        )}

        {debouncedQ && isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {debouncedQ && !isLoading && (data?.items?.length ?? 0) === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            No matching repositories.
          </p>
        )}

        {data?.items?.map((hit) => (
          <SearchResult key={hit.fullName} hit={hit} onAdded={onAdded} />
        ))}
      </div>
    </div>
  );
}

function SearchResult({ hit, onAdded }: { hit: SearchHit; onAdded: () => void }) {
  const [adding, setAdding] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  async function add() {
    setAdding(true);
    try {
      await api.post('/api/internship-sources', {
        owner: hit.owner,
        repo: hit.repo,
      });
      setAdded(true);
      toast({ title: 'Repository added', description: `${hit.owner}/${hit.repo}` });
      // Let the toast show briefly before closing
      setTimeout(() => onAdded(), 300);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add repository';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <Github className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{hit.fullName}</p>
        {hit.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{hit.description}</p>
        )}
        <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3 fill-current" />
          {hit.stars.toLocaleString()}
        </p>
      </div>
      <Button
        size="sm"
        variant={added ? 'outline' : 'default'}
        onClick={add}
        disabled={adding || added}
        className="shrink-0"
      >
        {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : added ? <Check className="h-3.5 w-3.5" />
            : <Plus className="h-3.5 w-3.5" />}
        {added ? 'Added' : 'Add'}
      </Button>
    </div>
  );
}

function PasteTab({ onAdded }: { onAdded: () => void }) {
  const [value, setValue] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [isInternship, setIsInternship] = React.useState(true);
  const [adding, setAdding] = React.useState(false);

  const parsed = React.useMemo(() => parseRepoInput(value), [value]);

  async function add() {
    if (!parsed) return;
    setAdding(true);
    try {
      await api.post('/api/internship-sources', {
        owner: parsed.owner,
        repo: parsed.repo,
        ...(label.trim() ? { label: label.trim() } : {}),
        isInternship,
      });
      toast({ title: 'Repository added', description: `${parsed.owner}/${parsed.repo}` });
      onAdded();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add repository';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">GitHub URL or owner/repo</label>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://github.com/owner/repo  or  owner/repo"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
        {value && !parsed && (
          <p className="mt-1 text-xs text-destructive">
            Couldn't parse — try pasting the full GitHub URL.
          </p>
        )}
        {parsed && (
          <p className="mt-1 text-xs text-muted-foreground">
            Will pull from <span className="font-medium text-foreground">{parsed.owner}/{parsed.repo}</span>.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Label (optional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. 'Custom Summer 2027 list'"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Position type</label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setIsInternship(true)}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              isInternship
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            Internship
          </button>
          <button
            type="button"
            onClick={() => setIsInternship(false)}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              !isInternship
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            New grad
          </button>
        </div>
      </div>

      <Button
        onClick={add}
        disabled={!parsed || adding}
        className="w-full gap-1.5"
      >
        {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Add repository
      </Button>
    </div>
  );
}

function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const s = input.trim();
  if (!s) return null;

  // Try URL form first
  const urlMatch = s.match(/github\.com\/([^/\s]+)\/([^/\s?#]+)/i);
  if (urlMatch) {
    const owner = urlMatch[1]!.trim();
    const repo = urlMatch[2]!.trim().replace(/\.git$/, '');
    if (owner && repo) return { owner, repo };
  }

  // Plain "owner/repo" form
  const shortMatch = s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1]!.trim(), repo: shortMatch[2]!.trim() };
  }

  return null;
}
