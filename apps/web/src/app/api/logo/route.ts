import { type NextRequest, NextResponse } from 'next/server';

// Logo source priority:
// 1. Logo.dev  — high-quality logos, free public token
// 2. Google S2 favicons — always works, lower quality fallback
const PK = process.env['LOGO_DEV_PUBLISHABLE_KEY'] ?? 'pk_public';
const LOGO_SOURCES = (domain: string) => [
  `https://img.logo.dev/${domain}?token=${PK}&size=128`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
];

// In-memory cache for company domain lookups (persists across requests in same worker)
const domainCache = new Map<string, string>();

// Use Clearbit Autocomplete API to find real company domain
async function lookupCompanyDomain(companyName: string): Promise<string | null> {
  const cacheKey = companyName.toLowerCase().trim();
  if (domainCache.has(cacheKey)) {
    return domainCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (!res.ok) return null;
    
    const results = await res.json() as Array<{ name: string; domain: string; logo: string }>;
    const firstResult = results[0];
    if (firstResult?.domain) {
      domainCache.set(cacheKey, firstResult.domain);
      return firstResult.domain;
    }
  } catch {
    // Clearbit lookup failed, will fall back to guessing
  }
  
  return null;
}

// Fallback: guess domain from company name
function guessCompanyDomain(company: string): string {
  let name = company.toLowerCase().trim();
  name = name
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?|group|holdings|technologies|technology|tech|solutions|services|consulting|partners|&\s*co\.?)$/i, '')
    .trim();
  name = name.replace(/^the\s+/i, '');
  return name.replace(/[^a-z0-9]/g, '') + '.com';
}

export async function GET(req: NextRequest) {
  // Support both ?domain= and ?company= parameters
  let domain = req.nextUrl.searchParams.get('domain');
  const company = req.nextUrl.searchParams.get('company');
  
  // If company name provided, look up the real domain
  if (company && !domain) {
    domain = await lookupCompanyDomain(company);
    if (!domain) {
      domain = guessCompanyDomain(company);
    }
  }
  
  if (!domain || !/^[a-zA-Z0-9.-]+$/.test(domain)) {
    return new NextResponse(null, { status: 400 });
  }

  for (const url of LOGO_SOURCES(domain)) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ApplyMe/1.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') ?? 'image/png';
      // Skip HTML responses (some services return 200 with an error page)
      if (contentType.includes('text/html')) continue;

      const buffer = await res.arrayBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    } catch {
      continue;
    }
  }

  return new NextResponse(null, { status: 404 });
}
