import { NextRequest, NextResponse } from 'next/server';

const cache = new Map<string, { text: string; expiresAt: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ text: '' }, { status: 400 });

  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ text: cached.text });
  }

  try {
    const text = await fetchDescription(url);
    cache.set(url, { text, expiresAt: Date.now() + TTL_MS });
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: '' });
  }
}

async function fetchDescription(jobUrl: string): Promise<string> {
  const liMatch = jobUrl.match(/linkedin\.com\/jobs\/view\/(\d+)/i);
  if (liMatch) {
    const jobId = liMatch[1];
    const apiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.linkedin.com/',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    return extractLinkedInDescription(html);
  }

  // Generic fallback: fetch the page and extract likely description section
  const res = await fetch(jobUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return '';
  const html = await res.text();
  return extractGenericDescription(html);
}

function extractLinkedInDescription(html: string): string {
  // LinkedIn guest API embeds description in a <div class="description__text"> or
  // in a <section class="show-more-less-html"> block
  const patterns = [
    /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const text = stripHtml(match[1]);
      if (text.length > 100) return text;
    }
  }

  // Try JSON-LD
  const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch?.[1]) {
    try {
      const data = JSON.parse(jsonLdMatch[1]) as Record<string, unknown>;
      const desc = data['description'];
      if (typeof desc === 'string' && desc.length > 50) return stripHtml(desc);
    } catch { /* ignore */ }
  }

  return '';
}

function extractGenericDescription(html: string): string {
  // Try JSON-LD first (most ATS pages embed it)
  const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
      try {
        const data = JSON.parse(inner) as Record<string, unknown>;
        const desc = data['description'];
        if (typeof desc === 'string' && desc.length > 50) return stripHtml(desc);
      } catch { /* ignore */ }
    }
  }

  // Common ATS description selectors (Greenhouse, Lever, Ashby, Workday)
  const patterns = [
    /<div[^>]*id="job-description"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*posting-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*jobDescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const text = stripHtml(match[1]);
      if (text.length > 100) return text;
    }
  }

  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
