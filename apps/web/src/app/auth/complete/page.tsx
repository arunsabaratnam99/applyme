'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const COOKIE_NAME = 'am_session';

export default function AuthCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get('token');

    if (!token) {
      router.replace('/login?error=missing_token');
      return;
    }

    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${secure}`;

    window.history.replaceState(null, '', '/auth/complete');
    router.replace('/jobs');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
