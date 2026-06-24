'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTopBar, type PageTopBarTab } from '@/components/layout/page-top-bar';
import { BrowseView } from './_views/browse';
import { SavedView } from './_views/saved';
import { AppliedView } from './_views/applied';
import { SourcesView } from './_views/sources';
import { InsightsView } from './_views/insights';

const TABS: PageTopBarTab[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'sources', label: 'Sources' },
  { id: 'insights', label: 'Insights' },
];

const VALID_TABS = new Set(TABS.map((t) => t.id));

function InternshipsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') ?? 'browse';
  const tab = VALID_TABS.has(tabParam) ? tabParam : 'browse';

  function handleTabChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === 'browse') params.delete('tab');
    else params.set('tab', id);
    const qs = params.toString();
    router.push((qs ? `/internships?${qs}` : '/internships') as unknown as never);
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageTopBar
        title="Internships"
        tabs={TABS}
        activeTab={tab}
        onTabChange={handleTabChange}
      />

      <div className="flex-1">
        {tab === 'browse' && <BrowseView />}
        {tab === 'saved' && <SavedView />}
        {tab === 'applied' && <AppliedView />}
        {tab === 'sources' && <SourcesView />}
        {tab === 'insights' && <InsightsView />}
      </div>
    </div>
  );
}



export default function InternshipsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <InternshipsPageInner />
    </Suspense>
  );
}
