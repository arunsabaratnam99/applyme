import { type NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'am_session';

export function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Set the session cookie from the web origin (localhost:3000) so it is
  // sent with every subsequent fetch to the API via credentials:'include'.
  const res = NextResponse.redirect(new URL('/jobs', req.url));
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
