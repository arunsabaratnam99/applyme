'use client';

import React from 'react';
import { GraduationCap, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface University {
  name: string;
  domain: string;
}

function mku(name: string, domain: string): University {
  return { name, domain };
}

const UNIVERSITIES: University[] = [
  // Canada
  mku('University of Toronto', 'utoronto.ca'),
  mku('University of British Columbia', 'ubc.ca'),
  mku('McGill University', 'mcgill.ca'),
  mku('University of Alberta', 'ualberta.ca'),
  mku('McMaster University', 'mcmaster.ca'),
  mku('University of Ottawa', 'uottawa.ca'),
  mku('University of Waterloo', 'uwaterloo.ca'),
  mku('Western University', 'uwo.ca'),
  mku("Queen's University", 'queensu.ca'),
  mku('University of Calgary', 'ucalgary.ca'),
  mku('Simon Fraser University', 'sfu.ca'),
  mku('Dalhousie University', 'dal.ca'),
  mku('University of Manitoba', 'umanitoba.ca'),
  mku('University of Saskatchewan', 'usask.ca'),
  mku('Carleton University', 'carleton.ca'),
  mku('York University', 'yorku.ca'),
  mku('Toronto Metropolitan University', 'torontomu.ca'),
  mku('Concordia University', 'concordia.ca'),
  mku('Université de Montréal', 'umontreal.ca'),
  mku('Université Laval', 'ulaval.ca'),
  mku('University of Victoria', 'uvic.ca'),
  mku('University of Guelph', 'uoguelph.ca'),
  mku('University of Windsor', 'uwindsor.ca'),
  mku('Brock University', 'brocku.ca'),
  mku('Wilfrid Laurier University', 'wlu.ca'),
  mku('Athabasca University', 'athabascau.ca'),
  mku('OCAD University', 'ocadu.ca'),
  mku('Ontario Tech University', 'ontariotechu.ca'),
  mku('University of Regina', 'uregina.ca'),
  mku('Memorial University of Newfoundland', 'mun.ca'),
  mku('University of New Brunswick', 'unb.ca'),
  mku('Trent University', 'trentu.ca'),
  mku('University of Lethbridge', 'uleth.ca'),
  mku('Lakehead University', 'lakeheadu.ca'),
  mku('Saint Mary\'s University', 'smu.ca'),
  mku('University of Prince Edward Island', 'upei.ca'),
  mku('Vancouver Island University', 'viu.ca'),
  // USA
  mku('Massachusetts Institute of Technology', 'mit.edu'),
  mku('Stanford University', 'stanford.edu'),
  mku('Harvard University', 'harvard.edu'),
  mku('California Institute of Technology', 'caltech.edu'),
  mku('University of California, Berkeley', 'berkeley.edu'),
  mku('Carnegie Mellon University', 'cmu.edu'),
  mku('Princeton University', 'princeton.edu'),
  mku('Yale University', 'yale.edu'),
  mku('Columbia University', 'columbia.edu'),
  mku('University of Chicago', 'uchicago.edu'),
  mku('University of Pennsylvania', 'upenn.edu'),
  mku('Cornell University', 'cornell.edu'),
  mku('Johns Hopkins University', 'jhu.edu'),
  mku('Duke University', 'duke.edu'),
  mku('Northwestern University', 'northwestern.edu'),
  mku('University of Michigan', 'umich.edu'),
  mku('New York University', 'nyu.edu'),
  mku('University of Texas at Austin', 'utexas.edu'),
  mku('Georgia Institute of Technology', 'gatech.edu'),
  mku('University of Illinois Urbana-Champaign', 'illinois.edu'),
  mku('University of Washington', 'uw.edu'),
  mku('University of California, Los Angeles', 'ucla.edu'),
  mku('University of California, San Diego', 'ucsd.edu'),
  mku('University of Wisconsin-Madison', 'wisc.edu'),
  mku('Purdue University', 'purdue.edu'),
  mku('Brown University', 'brown.edu'),
  mku('Dartmouth College', 'dartmouth.edu'),
  mku('Vanderbilt University', 'vanderbilt.edu'),
  mku('Rice University', 'rice.edu'),
  mku('Emory University', 'emory.edu'),
  mku('University of Notre Dame', 'nd.edu'),
  mku('Tufts University', 'tufts.edu'),
  mku('Boston University', 'bu.edu'),
  mku('Northeastern University', 'northeastern.edu'),
  mku('University of Southern California', 'usc.edu'),
  mku('University of Virginia', 'virginia.edu'),
  mku('University of Florida', 'ufl.edu'),
  mku('University of North Carolina at Chapel Hill', 'unc.edu'),
  mku('University of Maryland', 'umd.edu'),
  mku('Ohio State University', 'osu.edu'),
  mku('Penn State University', 'psu.edu'),
  mku('University of Minnesota', 'umn.edu'),
  mku('University of Colorado Boulder', 'colorado.edu'),
  mku('University of Arizona', 'arizona.edu'),
  mku('Arizona State University', 'asu.edu'),
  mku('Michigan State University', 'msu.edu'),
  mku('University of Pittsburgh', 'pitt.edu'),
  mku('Case Western Reserve University', 'case.edu'),
  mku('Rensselaer Polytechnic Institute', 'rpi.edu'),
  mku('Worcester Polytechnic Institute', 'wpi.edu'),
  // UK
  mku('University of Oxford', 'ox.ac.uk'),
  mku('University of Cambridge', 'cam.ac.uk'),
  mku('Imperial College London', 'imperial.ac.uk'),
  mku('University College London', 'ucl.ac.uk'),
  mku('London School of Economics', 'lse.ac.uk'),
  mku('University of Edinburgh', 'ed.ac.uk'),
  mku('University of Manchester', 'manchester.ac.uk'),
  mku("King's College London", 'kcl.ac.uk'),
  mku('University of Bristol', 'bristol.ac.uk'),
  mku('University of Glasgow', 'gla.ac.uk'),
  // Europe
  mku('ETH Zurich', 'ethz.ch'),
  mku('EPFL', 'epfl.ch'),
  mku('Technical University of Munich', 'tum.de'),
  mku('Delft University of Technology', 'tudelft.nl'),
  mku('University of Amsterdam', 'uva.nl'),
  mku('KU Leuven', 'kuleuven.be'),
  // Australia
  mku('University of Melbourne', 'unimelb.edu.au'),
  mku('University of Sydney', 'sydney.edu.au'),
  mku('Australian National University', 'anu.edu.au'),
  mku('University of Queensland', 'uq.edu.au'),
  mku('Monash University', 'monash.edu'),
  mku('University of New South Wales', 'unsw.edu.au'),
  // Asia
  mku('National University of Singapore', 'nus.edu.sg'),
  mku('Nanyang Technological University', 'ntu.edu.sg'),
  mku('University of Tokyo', 'u-tokyo.ac.jp'),
  mku('Seoul National University', 'snu.ac.kr'),
  mku('Hong Kong University of Science and Technology', 'ust.hk'),
  mku('Peking University', 'pku.edu.cn'),
  mku('Tsinghua University', 'tsinghua.edu.cn'),
  mku('Indian Institute of Technology Bombay', 'iitb.ac.in'),
  mku('Indian Institute of Technology Delhi', 'iitd.ac.in'),
];

const UniLogo = React.memo(function UniLogo({ domain, name, size }: { domain: string; name: string; size: number }) {
  const [err, setErr] = React.useState(false);
  const logo = `/api/logo?domain=${encodeURIComponent(domain)}`;
  React.useEffect(() => { setErr(false); }, [domain]);

  if (err) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-sm bg-muted flex items-center justify-center shrink-0"
      >
        <GraduationCap className="h-3 w-3 text-muted-foreground" />
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

interface UniversityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function UniversityAutocomplete({
  value,
  onChange,
  placeholder = 'University of Toronto',
  className,
}: UniversityAutocompleteProps) {
  const [query, setQuery] = React.useState(value);
  const [open, setOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<University[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const logoOverrideRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setQuery(value);
    logoOverrideRef.current = null;
  }, [value]);

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

  function getSuggestions(q: string): University[] {
    if (!q.trim()) return UNIVERSITIES.slice(0, 8);
    const lower = q.toLowerCase();
    return UNIVERSITIES.filter((u) => u.name.toLowerCase().includes(lower)).slice(0, 8);
  }

  // Derive domain for selected value — prefer override ref, then static lookup
  const selectedDomain = React.useMemo(() => {
    if (!query.trim()) return null;
    if (logoOverrideRef.current) return logoOverrideRef.current;
    const match = UNIVERSITIES.find((u) => u.name.toLowerCase() === query.toLowerCase());
    return match ? match.domain : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    logoOverrideRef.current = null;
    setQuery(val);
    onChange(val);
    setSuggestions(getSuggestions(val));
    setOpen(true);
  }

  function handleFocus() {
    setSuggestions(getSuggestions(query));
    setOpen(true);
  }

  function handleSelect(uni: University) {
    logoOverrideRef.current = uni.domain;
    setQuery(uni.name);
    onChange(uni.name);
    setOpen(false);
  }

  function handleClear() {
    logoOverrideRef.current = null;
    setQuery('');
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          {selectedDomain ? (
            <UniLogo domain={selectedDomain} name={query} size={16} />
          ) : (
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-background pl-9 pr-16 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="pointer-events-none p-1">
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </div>
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {query.trim() ? 'Results' : 'Popular'}
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {suggestions.map((uni) => (
              <li key={uni.domain}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(uni); }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors',
                    uni.name === value && 'bg-accent',
                  )}
                >
                  <UniLogo domain={uni.domain} name={uni.name} size={24} />
                  <span className="truncate">{uni.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
