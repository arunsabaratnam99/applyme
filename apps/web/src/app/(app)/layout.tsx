'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { api, ApiError } from '@/lib/api';

interface ProfileData {
  userId: string;
  roles: string[] | null;
  locations: string[] | null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    api.get<ProfileData | null>('/api/profile')
      .then((data) => {
        const incomplete = !data;
        if (incomplete) {
          router.replace('/login?step=2');
        } else {
          setReady(true);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
        } else {
          // Non-auth error — let them through
          setReady(true);
        }
      });
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
