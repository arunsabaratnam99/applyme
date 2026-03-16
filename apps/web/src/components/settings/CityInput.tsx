'use client';

import React from 'react';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/cn';

const CITIES: string[] = [
  'Toronto, ON', 'Vancouver, BC', 'Montreal, QC', 'Calgary, AB', 'Edmonton, AB',
  'Ottawa, ON', 'Winnipeg, MB', 'Quebec City, QC', 'Hamilton, ON', 'Kitchener, ON',
  'London, ON', 'Victoria, BC', 'Halifax, NS', 'Saskatoon, SK', 'Regina, SK',
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'San Francisco, CA',
  'Seattle, WA', 'Boston, MA', 'Austin, TX', 'Denver, CO', 'Atlanta, GA',
  'Miami, FL', 'Phoenix, AZ', 'Dallas, TX', 'San Diego, CA', 'Portland, OR',
  'Minneapolis, MN', 'Washington, DC', 'Philadelphia, PA', 'Detroit, MI', 'San Jose, CA',
  'London, UK', 'Manchester, UK', 'Birmingham, UK', 'Edinburgh, UK', 'Bristol, UK',
  'Sydney, NSW', 'Melbourne, VIC', 'Brisbane, QLD', 'Perth, WA', 'Adelaide, SA',
  'Dublin, IE', 'Berlin, DE', 'Amsterdam, NL', 'Paris, FR', 'Zurich, CH',
];

interface CityInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  highlighted?: boolean;
}

export function CityInput({ value, onChange, placeholder = 'Toronto, ON', className, highlighted }: CityInputProps) {
  const [query, setQuery] = React.useState(value);
  const [open, setOpen] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return CITIES.slice(0, 10);
    const q = query.toLowerCase();
    return CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 10);
  }, [query]);

  function handleSelect(city: string) {
    setQuery(city);
    onChange(city);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery('');
    onChange('');
    inputRef.current?.focus();
  }

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            'w-full rounded-lg border bg-background pl-9 pr-8 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors',
            highlighted ? 'border-primary/60 bg-primary/5' : 'border-input',
          )}
        />
        {query && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <button
              type="button"
              onMouseDown={handleClear}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.map((city) => (
              <li key={city}>
                <button
                  type="button"
                  onMouseDown={() => handleSelect(city)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-accent',
                    value === city && 'bg-primary/10 text-primary font-medium',
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {city}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
