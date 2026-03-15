import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8787';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('am_session')?.value;

  const formData = await req.formData();

  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(session ? { Cookie: `am_session=${session}` } : {}),
    },
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
