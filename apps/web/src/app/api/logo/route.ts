import { type NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain');
  if (!domain || !/^[a-zA-Z0-9.-]+$/.test(domain)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const res = await fetch(`https://logo.clearbit.com/${domain}`, {
      headers: { 'User-Agent': 'ApplyMe/1.0' },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return new NextResponse(null, { status: 404 });

    const contentType = res.headers.get('content-type') ?? 'image/png';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
