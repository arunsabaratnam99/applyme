import { type NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/server-auth';

interface LogoDevResult {
  name: string;
  domain: string;
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);

  const sk = process.env['LOGO_DEV_SECRET_KEY'];
  if (!sk) return NextResponse.json({ error: 'LOGO_DEV_SECRET_KEY not configured' }, { status: 500 });

  try {
    const res = await fetch(
      `https://api.logo.dev/search?q=${encodeURIComponent(q)}&strategy=suggest`,
      {
        headers: {
          Authorization: `Bearer ${sk}`,
          'User-Agent': 'ApplyMe/1.0',
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) return NextResponse.json([]);

    const data = (await res.json()) as LogoDevResult[];
    return NextResponse.json(
      data.slice(0, 8).map((r) => ({
        name: r.name,
        domain: r.domain,
        logo: `/api/logo?domain=${encodeURIComponent(r.domain)}`,
      })),
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch {
    return NextResponse.json([]);
  }
}
