'use client';

import React from 'react';
import { Building2, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Company {
  name: string;
  domain: string;
  logo: string;
}

function mkc(name: string, domain: string): Company {
  return { name, domain, logo: `/api/logo?domain=${encodeURIComponent(domain)}` };
}

const ALL_COMPANIES: Company[] = [
  mkc('Google', 'google.com'),
  mkc('Microsoft', 'microsoft.com'),
  mkc('Apple', 'apple.com'),
  mkc('Amazon', 'amazon.com'),
  mkc('Meta', 'meta.com'),
  mkc('Netflix', 'netflix.com'),
  mkc('Spotify', 'spotify.com'),
  mkc('Uber', 'uber.com'),
  mkc('Airbnb', 'airbnb.com'),
  mkc('Salesforce', 'salesforce.com'),
  mkc('Oracle', 'oracle.com'),
  mkc('GitHub', 'github.com'),
  mkc('Vercel', 'vercel.com'),
  mkc('Linear', 'linear.app'),
  mkc('Figma', 'figma.com'),
  mkc('Notion', 'notion.so'),
  mkc('Atlassian', 'atlassian.com'),
  mkc('Stripe', 'stripe.com'),
  mkc('Twilio', 'twilio.com'),
  mkc('Cloudflare', 'cloudflare.com'),
  mkc('Snowflake', 'snowflake.com'),
  mkc('Databricks', 'databricks.com'),
  mkc('HashiCorp', 'hashicorp.com'),
  mkc('Supabase', 'supabase.com'),
  mkc('Datadog', 'datadoghq.com'),
  mkc('Shopify', 'shopify.com'),
  mkc('OpenAI', 'openai.com'),
  mkc('Anthropic', 'anthropic.com'),
  mkc('Hugging Face', 'huggingface.co'),
  mkc('Perplexity', 'perplexity.ai'),
  mkc('Cohere', 'cohere.com'),
  mkc('Wealthsimple', 'wealthsimple.com'),
  mkc('Lightspeed', 'lightspeedhq.com'),
  mkc('Kinaxis', 'kinaxis.com'),
  mkc('OpenText', 'opentext.com'),
  mkc('Telus', 'telus.com'),
  mkc('Rogers', 'rogers.com'),
  mkc('Bell Canada', 'bell.ca'),
  mkc('BlackBerry', 'blackberry.com'),
  mkc('Bombardier', 'bombardier.com'),
  mkc('PointClickCare', 'pointclickcare.com'),
  mkc('Rippling', 'rippling.com'),
  mkc('Workday', 'workday.com'),
  mkc('Greenhouse', 'greenhouse.io'),
  mkc('Lever', 'lever.co'),
  mkc('CrowdStrike', 'crowdstrike.com'),
  mkc('Palo Alto Networks', 'paloaltonetworks.com'),
  mkc('Scotiabank', 'scotiabank.com'),
  mkc('RBC', 'rbc.com'),
  mkc('TD Bank', 'td.com'),
  mkc('BMO', 'bmo.com'),
  mkc('CIBC', 'cibc.com'),
  mkc('Manulife', 'manulife.com'),
  mkc('Sun Life', 'sunlife.com'),
  mkc('Deloitte', 'deloitte.com'),
  mkc('KPMG', 'kpmg.com'),
  mkc('PwC', 'pwc.com'),
  mkc('EY', 'ey.com'),
  mkc('McKinsey & Company', 'mckinsey.com'),
  mkc('Boston Consulting Group', 'bcg.com'),
  mkc('Accenture', 'accenture.com'),
  mkc('IBM', 'ibm.com'),
  mkc('Cisco', 'cisco.com'),
  mkc('Intel', 'intel.com'),
  mkc('NVIDIA', 'nvidia.com'),
  mkc('AMD', 'amd.com'),
  mkc('Qualcomm', 'qualcomm.com'),
  mkc('Tesla', 'tesla.com'),
  mkc('SpaceX', 'spacex.com'),
  mkc('Palantir', 'palantir.com'),
  mkc('Coinbase', 'coinbase.com'),
  mkc('Robinhood', 'robinhood.com'),
  mkc('DoorDash', 'doordash.com'),
  mkc('Lyft', 'lyft.com'),
  mkc('Slack', 'slack.com'),
  mkc('Zoom', 'zoom.us'),
  mkc('Dropbox', 'dropbox.com'),
  mkc('Box', 'box.com'),
  mkc('Okta', 'okta.com'),
  mkc('ServiceNow', 'servicenow.com'),
  mkc('Splunk', 'splunk.com'),
  mkc('MongoDB', 'mongodb.com'),
  mkc('Redis', 'redis.com'),
  mkc('Elastic', 'elastic.co'),
  mkc('Grafana Labs', 'grafana.com'),
];

const POPULAR_NAMES = new Set([
  'Shopify', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Stripe', 'Atlassian',
  'Figma', 'Notion', 'Vercel', 'Linear', 'OpenAI', 'Scotiabank', 'RBC',
]);
const POPULAR = ALL_COMPANIES.filter((c) => POPULAR_NAMES.has(c.name));

const CompanyLogo = React.memo(function CompanyLogo({ logo, name, size }: { logo: string; name: string; size: number }) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); }, [logo]);

  if (err || !logo) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-sm bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0"
      >
        {name.charAt(0)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="rounded-sm object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  );
});

interface CompanyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CompanyInput({ value, onChange, placeholder = 'Acme Corp', className }: CompanyInputProps) {
  const [query, setQuery] = React.useState(value);
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<Company[]>(POPULAR);
  const [loading, setLoading] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  // Stores logo for companies from live API not in static list
  const [logoOverride, setLogoOverride] = React.useState<string | null>(null);

  // Sync external value (e.g. resume autofill) and restore logo
  React.useEffect(() => {
    setQuery(value);
    if (!value.trim()) {
      setLogoOverride(null);
      return;
    }
    const staticMatch = ALL_COMPANIES.find((c) => c.name.toLowerCase() === value.toLowerCase());
    if (staticMatch) {
      setLogoOverride(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/companies/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Company[]) => {
        const match = data.find((c) => c.name.toLowerCase() === value.toLowerCase()) ?? data[0];
        if (match) setLogoOverride(match.logo);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [value]);

  // Derive logo: prefer live-search override, then static list lookup
  const selectedLogo = React.useMemo(() => {
    if (!query.trim()) return null;
    if (logoOverride) return logoOverride;
    const match = ALL_COMPANIES.find((c) => c.name.toLowerCase() === query.toLowerCase());
    return match ? match.logo : null;
  }, [query, logoOverride]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        onChange(query);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, onChange]);

  async function search(q: string) {
    if (!q.trim()) {
      setResults(POPULAR);
      setLoading(false);
      return;
    }
    // Check static list first for instant results
    const lower = q.toLowerCase();
    const staticMatches = ALL_COMPANIES.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.domain.toLowerCase().includes(lower),
    ).slice(0, 8);
    if (staticMatches.length > 0) {
      setResults(staticMatches);
    }

    // Also hit live API for broader search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Company[];
      if (data.length > 0) setResults(data);
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && staticMatches.length === 0) setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  }

  function handleFocus() {
    setResults(query.trim() ? results : POPULAR);
    setOpen(true);
  }

  function handleSelect(company: Company) {
    setLogoOverride(company.logo);
    setQuery(company.name);
    onChange(company.name);
    setOpen(false);
  }

  function handleClear() {
    setLogoOverride(null);
    setQuery('');
    onChange('');
    setResults(POPULAR);
    inputRef.current?.focus();
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative flex items-center">
        {/* Logo or default icon */}
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          {selectedLogo ? (
            <CompanyLogo logo={selectedLogo} name={query} size={16} />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-background pl-9 pr-14 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {loading && (
            <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
          {query && !loading && (
            <button type="button" onClick={handleClear} className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="pointer-events-none p-1">
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </div>
        </div>
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
        >
          {!query.trim() && (
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Popular
            </div>
          )}
          {query.trim() && results.length > 0 && (
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Results
            </div>
          )}
          {results.length === 0 && query.trim() && !loading && (
            <div className="px-3 py-3 text-xs text-muted-foreground">No results — press Enter to use "{query}"</div>
          )}
          <ul className="max-h-56 overflow-y-auto">
            {results.map((c) => (
              <li key={c.domain}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
                >
                  <CompanyLogo logo={c.logo} name={c.name} size={24} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{c.domain}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
