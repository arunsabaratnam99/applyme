import { type NextRequest, NextResponse } from 'next/server';

// Logo source priority:
// 1. Logo.dev  — high-quality logos, free public token
// 2. Google S2 favicons — always works, lower quality fallback
const PK = process.env['LOGO_DEV_PUBLISHABLE_KEY'] ?? 'pk_public';
const LOGO_SOURCES = (domain: string) => [
  `https://img.logo.dev/${domain}?token=${PK}&size=128`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
];

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain');
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
