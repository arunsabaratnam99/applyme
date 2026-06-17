import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'am_session';

export interface SessionPayload {
  sub: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

export async function requireSession(
  req: NextRequest,
): Promise<SessionPayload | NextResponse> {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as SessionPayload;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
