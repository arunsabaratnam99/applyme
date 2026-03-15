'use client';

import React from 'react';
import useSWR, { mutate } from 'swr';
import {
  Star, Plus, Trash2, ChevronDown, ChevronRight,
  Bell, BellOff, Briefcase, TrendingUp, Users, Building2, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/cn';

/* ── Types ───────────────────────────────────────────────────── */

interface WatchlistItem {
  id: string;
  itemType: 'company' | 'role' | 'keyword';
  value: string;
  domain: string | null;
  companyTier: 'tier1' | 'standard';
  autoDiscoverPeers: boolean;
  atsUrl: string | null;
  notifyNewJobs: boolean;
  notifyRoleChanges: boolean;
  notifyFunding: boolean;
  notifyHeadcount: boolean;
}

interface PeerEntry {
  peerCompany: string;
  similarityScore: number;
  peerTags: string[];
}

interface WatchlistResponse {
  id: string;
  label: string;
  items: WatchlistItem[];
  peerMap: Record<string, PeerEntry[]>;
}

interface ClearbitCompany {
  name: string;
  domain: string;
  logo: string;
}

/* ── Notification options config ─────────────────────────────── */

const NOTIF_OPTIONS = [
  { key: 'notifyNewJobs',      icon: <Briefcase className="h-3.5 w-3.5" />, label: 'New jobs' },
  { key: 'notifyRoleChanges',  icon: <Users className="h-3.5 w-3.5" />,    label: 'Role changes' },
  { key: 'notifyFunding',      icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Funding news' },
  { key: 'notifyHeadcount',    icon: <Building2 className="h-3.5 w-3.5" />, label: 'Headcount' },
] as const;

type NotifKey = (typeof NOTIF_OPTIONS)[number]['key'];

const KEY = '/api/watchlist';

/* ── Page ────────────────────────────────────────────────────── */

export default function WatchlistPage() {
  const { data, isLoading } = useSWR<WatchlistResponse>(KEY, (url: string) => api.get<WatchlistResponse>(url));
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showSearch, setShowSearch] = React.useState(false);

  async function handleAdd(company: ClearbitCompany) {
    const tempId = `temp-${Date.now()}`;
    const tempItem: WatchlistItem = {
      id: tempId,
      itemType: 'company',
      value: company.name,
      domain: company.domain,
      companyTier: 'standard',
      autoDiscoverPeers: false,
      atsUrl: null,
      notifyNewJobs: true,
      notifyRoleChanges: false,
      notifyFunding: false,
      notifyHeadcount: false,
    };
    // Close search first so the new card doesn't flash under the open panel
    setShowSearch(false);
    // Optimistic: add immediately
    await mutate(
      KEY,
      (cur: WatchlistResponse | undefined) => cur
        ? { ...cur, items: [...cur.items, tempItem] }
        : { id: '', label: 'My Watchlist', items: [tempItem], peerMap: {} },
      { revalidate: false },
    );
    try {
      await api.post('/api/watchlist/items', {
        itemType: 'company',
        value: company.name,
        atsUrl: null,
        companyTier: 'standard',
        autoDiscoverPeers: false,
      });
      await mutate(KEY); // replace temp with real data
      toast({ title: `Added ${company.name} to watchlist` });
    } catch {
      // Revert on failure
      await mutate(
        KEY,
        (cur: WatchlistResponse | undefined) => cur
          ? { ...cur, items: cur.items.filter((i) => i.id !== tempId) }
          : cur,
        { revalidate: false },
      );
      toast({ title: 'Failed to add company', variant: 'destructive' });
    }
  }

  async function handleDelete(id: string, value: string) {
    // Optimistic: remove immediately
    await mutate(
      KEY,
      (cur: WatchlistResponse | undefined) => cur
        ? { ...cur, items: cur.items.filter((i) => i.id !== id) }
        : cur,
      { revalidate: false },
    );
    if (expandedId === id) setExpandedId(null);
    try {
      await api.delete(`/api/watchlist/items/${id}`);
      await mutate(KEY);
      toast({ title: `Removed "${value}"` });
    } catch {
      await mutate(KEY); // revert by revalidating
      toast({ title: 'Failed to remove', variant: 'destructive' });
    }
  }

  async function handleAddPeer(peerName: string) {
    const tempId = `temp-${Date.now()}`;
    const tempItem: WatchlistItem = {
      id: tempId,
      itemType: 'company',
      value: peerName,
      domain: null,
      companyTier: 'standard',
      autoDiscoverPeers: false,
      atsUrl: null,
      notifyNewJobs: true,
      notifyRoleChanges: false,
      notifyFunding: false,
      notifyHeadcount: false,
    };
    await mutate(
      KEY,
      (cur: WatchlistResponse | undefined) => cur
        ? { ...cur, items: [...cur.items, tempItem] }
        : { id: '', label: 'My Watchlist', items: [tempItem], peerMap: {} },
      { revalidate: false },
    );
    try {
      await api.post('/api/watchlist/items', {
        itemType: 'company',
        value: peerName,
        atsUrl: null,
        companyTier: 'standard',
        autoDiscoverPeers: false,
      });
      await mutate(KEY);
      toast({ title: `Added "${peerName}"` });
    } catch {
      await mutate(
        KEY,
        (cur: WatchlistResponse | undefined) => cur
          ? { ...cur, items: cur.items.filter((i) => i.id !== tempId) }
          : cur,
        { revalidate: false },
      );
      toast({ title: 'Failed to add peer', variant: 'destructive' });
    }
  }

  const DEFAULT_NOTIFS: Record<NotifKey, boolean> = {
    notifyNewJobs: true,
    notifyRoleChanges: false,
    notifyFunding: false,
    notifyHeadcount: false,
  };

  const [localNotifs, setLocalNotifs] = React.useState<Record<string, Record<NotifKey, boolean>>>({});

  function getNotifs(id: string): Record<NotifKey, boolean> {
    return localNotifs[id] ?? DEFAULT_NOTIFS;
  }

  function handleToggleNotif(id: string, notifKey: NotifKey, current: boolean) {
    setLocalNotifs((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? DEFAULT_NOTIFS),
        [notifKey]: !current,
      },
    }));
  }

  const watchedNames = new Set(data?.items.map((i) => i.value.toLowerCase()) ?? []);

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Watchlist
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track companies and get notified about new jobs, funding, and headcount changes
          </p>
        </div>
        {!showSearch && (
          <Button size="sm" onClick={() => setShowSearch(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add company
          </Button>
        )}
      </div>

      {/* Company search */}
      {showSearch && (
        <div className="mb-5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Search for a company</p>
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              className="rounded-md p-1 hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <CompanySearch
            alreadyWatched={watchedNames}
            onSelect={(c) => handleAdd(c)}
          />
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data && data.items.length === 0 && !showSearch && (
        <div className="text-center py-20 text-muted-foreground">
          <Star className="h-10 w-10 mx-auto mb-4 opacity-25" />
          <p className="font-medium">Your watchlist is empty</p>
          <p className="text-sm mt-1 mb-4">Add companies to track jobs, funding, and team changes.</p>
          <Button size="sm" onClick={() => setShowSearch(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add your first company
          </Button>
        </div>
      )}

      {/* Company cards */}
      {data && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((item) => {
            const peers = data.peerMap[item.id] ?? [];
            const isExpanded = expandedId === item.id;
            const activeNotifs = NOTIF_OPTIONS.filter((o) => item[o.key]);

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Logo */}
                  <CompanyLogo
                    domain={item.domain}
                    name={item.value}
                    size={38}
                  />

                  {/* Name + tier */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.value}</span>
                      {item.companyTier === 'tier1' && (
                        <Badge variant="warning" className="text-[10px] py-0 px-1.5">Tier 1</Badge>
                      )}
                    </div>
                    {/* Active notification pills */}
                    {(() => {
                      const notifs = getNotifs(item.id);
                      const active = NOTIF_OPTIONS.filter((o) => notifs[o.key]);
                      return active.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {active.map((o) => (
                            <span
                              key={o.key}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium"
                            >
                              {o.icon}
                              {o.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <BellOff className="h-3 w-3" /> No notifications
                        </span>
                      );
                    })()}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Notify
                      <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(item.id, item.value)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded: notification toggles + peer companies */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 px-4 py-4 space-y-4">
                    {/* Notification toggles */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                        Notify me about
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {NOTIF_OPTIONS.map((opt) => {
                          const notifs = getNotifs(item.id);
                          const active = notifs[opt.key];
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => handleToggleNotif(item.id, opt.key, active)}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all text-left',
                                active
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                              )}
                            >
                              <span className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground')}>
                                {opt.icon}
                              </span>
                              {opt.label}
                              {active && (
                                <span className="ml-auto h-2 w-2 rounded-full bg-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Peer companies */}
                    {peers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                          Similar companies
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {peers.map((peer) => {
                            const already = watchedNames.has(peer.peerCompany.toLowerCase());
                            return (
                              <button
                                key={peer.peerCompany}
                                type="button"
                                disabled={already}
                                onClick={() => handleAddPeer(peer.peerCompany)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                                  already
                                    ? 'border-primary/30 bg-primary/8 text-primary cursor-default'
                                    : 'border-border bg-background text-foreground hover:border-primary/60 hover:bg-accent',
                                )}
                              >
                                <PeerLogo name={peer.peerCompany} size={14} />
                                {peer.peerCompany}
                                <span className="text-muted-foreground text-[10px]">{peer.similarityScore}%</span>
                                {already ? (
                                  <span className="text-primary">✓</span>
                                ) : (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}

/* ── Company search ─────────────────────────────────────────── */

function mkc(name: string, domain: string): ClearbitCompany {
  return { name, domain, logo: `/api/logo?domain=${encodeURIComponent(domain)}` };
}

const ALL_COMPANIES: ClearbitCompany[] = [
  // Big Tech
  mkc('Google',      'google.com'),
  mkc('Microsoft',   'microsoft.com'),
  mkc('Apple',       'apple.com'),
  mkc('Amazon',      'amazon.com'),
  mkc('Meta',        'meta.com'),
  mkc('Netflix',     'netflix.com'),
  mkc('Spotify',     'spotify.com'),
  mkc('Uber',        'uber.com'),
  mkc('Airbnb',      'airbnb.com'),
  mkc('Salesforce',  'salesforce.com'),
  mkc('Oracle',      'oracle.com'),
  mkc('SAP',         'sap.com'),
  // Developer Tools / Cloud
  mkc('GitHub',      'github.com'),
  mkc('Vercel',      'vercel.com'),
  mkc('Linear',      'linear.app'),
  mkc('Figma',       'figma.com'),
  mkc('Notion',      'notion.so'),
  mkc('Atlassian',   'atlassian.com'),
  mkc('Stripe',      'stripe.com'),
  mkc('Twilio',      'twilio.com'),
  mkc('Cloudflare',  'cloudflare.com'),
  mkc('Snowflake',   'snowflake.com'),
  mkc('Databricks',  'databricks.com'),
  mkc('HashiCorp',   'hashicorp.com'),
  mkc('PlanetScale', 'planetscale.com'),
  mkc('Supabase',    'supabase.com'),
  mkc('Retool',      'retool.com'),
  mkc('Postman',     'postman.com'),
  mkc('Datadog',     'datadoghq.com'),
  mkc('New Relic',   'newrelic.com'),
  // Fintech / Payments
  mkc('Shopify',     'shopify.com'),
  mkc('Wealthsimple','wealthsimple.com'),
  mkc('Nuvei',       'nuvei.com'),
  mkc('Lightspeed',  'lightspeedhq.com'),
  mkc('Clearco',     'clearco.com'),
  mkc('Koho Financial', 'koho.ca'),
  mkc('Neo Financial',  'neo.ca'),
  mkc('Borrowell',   'borrowell.com'),
  mkc('TouchBistro', 'touchbistro.com'),
  // Canadian AI / Tech
  mkc('Cohere',      'cohere.com'),
  mkc('Waabi',       'waabi.ai'),
  mkc('BorealisAI',  'borealisai.com'),
  mkc('Layer 6',     'layer6.ai'),
  mkc('Darwin AI',   'darwinai.ca'),
  mkc('OpenAI',      'openai.com'),
  mkc('Anthropic',   'anthropic.com'),
  mkc('Mistral',     'mistral.ai'),
  mkc('Hugging Face','huggingface.co'),
  mkc('Perplexity',  'perplexity.ai'),
  // Canadian Enterprise / Supply Chain
  mkc('Kinaxis',     'kinaxis.com'),
  mkc('OpenText',    'opentext.com'),
  mkc('Ceridian',    'ceridian.com'),
  mkc('Descartes Systems', 'descartes.com'),
  mkc('Tecsys',      'tecsys.com'),
  // Canadian Health / Edtech
  mkc('PointClickCare', 'pointclickcare.com'),
  mkc('Jane App',    'janeapp.com'),
  mkc('Maple',       'getmaple.ca'),
  mkc('D2L',         'd2l.com'),
  mkc('Top Hat',     'tophat.com'),
  // Canadian Telco / Aerospace
  mkc('Telus',       'telus.com'),
  mkc('Rogers',      'rogers.com'),
  mkc('Bell Canada', 'bell.ca'),
  mkc('BlackBerry',  'blackberry.com'),
  mkc('Bombardier',  'bombardier.com'),
  mkc('CAE',         'cae.com'),
  // HR Tech
  mkc('Humi',        'humi.ca'),
  mkc('Rippling',    'rippling.com'),
  mkc('Workday',     'workday.com'),
  mkc('Greenhouse',  'greenhouse.io'),
  mkc('Lever',       'lever.co'),
  mkc('Lattice',     'lattice.com'),
  // Cybersecurity
  mkc('CrowdStrike', 'crowdstrike.com'),
  mkc('SentinelOne', 'sentinelone.com'),
  mkc('Palo Alto Networks', 'paloaltonetworks.com'),
  mkc('Arctic Wolf', 'arcticwolf.com'),
  mkc('eSentire',    'esentire.com'),
];

const POPULAR_NAMES = new Set(['Shopify', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Stripe', 'Atlassian', 'Figma', 'Notion', 'Vercel', 'Linear', 'Snowflake']);
const POPULAR = ALL_COMPANIES.filter((c) => POPULAR_NAMES.has(c.name));

function CompanySearch({
  alreadyWatched,
  onSelect,
}: {
  alreadyWatched: Set<string>;
  onSelect: (c: ClearbitCompany) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ClearbitCompany[]>(POPULAR);
  const [noResults, setNoResults] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function search(q: string) {
    if (!q.trim()) {
      setResults(POPULAR);
      setNoResults(false);
      setLoading(false);
      return;
    }
    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/companies/search?q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as ClearbitCompany[];
      setResults(data);
      setNoResults(data.length === 0);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setResults([]);
        setNoResults(true);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          placeholder="Search companies…"
          className="flex-1 bg-transparent text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
        />
        {loading && (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
        )}
      </div>

      {/* Results */}
      <div className="max-h-72 overflow-y-auto">
        {noResults && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No results for "{query}"</p>
        )}

        {!query && (
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Popular
          </p>
        )}

        {results.map((c) => {
          const watched = alreadyWatched.has(c.name.toLowerCase());
          return (
            <button
              key={c.domain}
              type="button"
              disabled={watched}
              onClick={() => !watched && onSelect(c)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors',
                watched
                  ? 'opacity-50 cursor-default bg-muted/30'
                  : 'hover:bg-accent cursor-pointer',
              )}
            >
              <ClearbitLogo logo={c.logo} name={c.name} size={28} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate">{c.name}</span>
                <span className="text-[11px] text-muted-foreground truncate">{c.domain}</span>
              </div>
              {watched ? (
                <span className="text-xs text-primary font-medium shrink-0">Watching</span>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">+ Add</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Logo helpers ────────────────────────────────────────────── */

const ClearbitLogo = React.memo(function ClearbitLogo({ logo, name, size }: { logo: string; name: string; size: number }) {
  const [err, setErr] = React.useState(false);

  React.useEffect(() => { setErr(false); }, [logo]);

  if (err || !logo) return <LogoFallback name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="rounded-md object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  );
});

const CompanyLogo = React.memo(function CompanyLogo({ domain, name, size }: { domain: string | null; name: string; size: number }) {
  const guessedDomain = domain ?? (name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com');
  const [err, setErr] = React.useState(false);

  React.useEffect(() => { setErr(false); }, [guessedDomain]);

  if (err) return <LogoFallback name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/logo?domain=${encodeURIComponent(guessedDomain)}`}
      alt={name}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="rounded-lg object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  );
});

const PeerLogo = React.memo(function PeerLogo({ name, size }: { name: string; size: number }) {
  const domain = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const [err, setErr] = React.useState(false);

  React.useEffect(() => { setErr(false); }, [domain]);

  if (err) return <LogoFallback name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/logo?domain=${encodeURIComponent(domain)}`}
      alt={name}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="rounded-sm object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  );
});

function LogoFallback({ name, size }: { name: string; size: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
