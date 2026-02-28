'use client';

import React from 'react';
import { X, Building2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Company {
  name: string;
  domain: string;
  logo: string;
}

interface CompanyAutocompleteProps {
  companies: Company[];
  onChange: (companies: Company[]) => void;
  className?: string;
}

const POPULAR: Company[] = [
  { name: 'Shopify', domain: 'shopify.com', logo: 'https://logo.clearbit.com/shopify.com' },
  { name: 'Google', domain: 'google.com', logo: 'https://logo.clearbit.com/google.com' },
  { name: 'Microsoft', domain: 'microsoft.com', logo: 'https://logo.clearbit.com/microsoft.com' },
  { name: 'Amazon', domain: 'amazon.com', logo: 'https://logo.clearbit.com/amazon.com' },
  { name: 'Apple', domain: 'apple.com', logo: 'https://logo.clearbit.com/apple.com' },
  { name: 'Meta', domain: 'meta.com', logo: 'https://logo.clearbit.com/meta.com' },
  { name: 'Stripe', domain: 'stripe.com', logo: 'https://logo.clearbit.com/stripe.com' },
  { name: 'Atlassian', domain: 'atlassian.com', logo: 'https://logo.clearbit.com/atlassian.com' },
  { name: 'Notion', domain: 'notion.so', logo: 'https://logo.clearbit.com/notion.so' },
  { name: 'Figma', domain: 'figma.com', logo: 'https://logo.clearbit.com/figma.com' },
  { name: 'Vercel', domain: 'vercel.com', logo: 'https://logo.clearbit.com/vercel.com' },
  { name: 'Linear', domain: 'linear.app', logo: 'https://logo.clearbit.com/linear.app' },
];

export function CompanyAutocomplete({ companies, onChange, className }: CompanyAutocompleteProps) {
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<Company[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchSuggestions(q: string) {
    if (!q.trim()) {
      setSuggestions(POPULAR.filter((p) => !companies.some((c) => c.domain === p.domain)));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as Array<{ name: string; domain: string; logo: string }>;
        setSuggestions(
          data
            .filter((d) => !companies.some((c) => c.domain === d.domain))
            .slice(0, 8)
            .map((d) => ({ name: d.name, domain: d.domain, logo: d.logo })),
        );
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200);
  }

  function handleFocus() {
    setOpen(true);
    if (!query) {
      setSuggestions(POPULAR.filter((p) => !companies.some((c) => c.domain === p.domain)));
    }
  }

  function selectCompany(company: Company) {
    if (!companies.some((c) => c.domain === company.domain)) {
      onChange([...companies, company]);
    }
    setQuery('');
    setSuggestions((prev) => prev.filter((s) => s.domain !== company.domain));
    inputRef.current?.focus();
  }

  function removeCompany(domain: string) {
    onChange(companies.filter((c) => c.domain !== domain));
  }

  return (
    <div className={cn('relative', className)}>
      {/* Selected pills */}
      {companies.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {companies.map((c) => (
            <div
              key={c.domain}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium shadow-sm"
            >
              <CompanyLogo logo={c.logo} name={c.name} size={16} />
              <span>{c.name}</span>
              <button
                type="button"
                onClick={() => removeCompany(c.domain)}
                className="ml-0.5 rounded-sm opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Search companies…"
          className="w-full rounded-lg border border-input bg-background pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
        />
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
        >
          {loading && (
            <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Searching…
            </div>
          )}
          {!loading && suggestions.length === 0 && query.length > 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">No results for "{query}"</div>
          )}
          {!loading && suggestions.length === 0 && !query && (
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Popular companies
            </div>
          )}
          {!loading && query.length > 0 && suggestions.length > 0 && (
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Results
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.domain}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectCompany(s); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
                >
                  <CompanyLogo logo={s.logo} name={s.name} size={24} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{s.name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{s.domain}</span>
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

function CompanyLogo({ logo, name, size }: { logo: string; name: string; size: number }) {
  const [err, setErr] = React.useState(false);
  if (err || !logo) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-sm bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0"
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
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className="rounded-sm object-contain flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
