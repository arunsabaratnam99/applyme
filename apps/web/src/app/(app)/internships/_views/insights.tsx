'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { BarChart3 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

// @nivo/sankey is heavy — load only on the client to avoid SSR weight.
const ResponsiveSankey = dynamic(
  () => import('@nivo/sankey').then((m) => m.ResponsiveSankey),
  { ssr: false },
);

type View = 'status' | 'source' | 'category';

interface SankeyData {
  nodes: Array<{ id: string }>;
  links: Array<{ source: string; target: string; value: number }>;
  empty: boolean;
}

const VIEW_TABS: Array<{ id: View; label: string; hint: string }> = [
  { id: 'status', label: 'Status', hint: "How your applications flow from Applied through to outcomes." },
  { id: 'source', label: 'Source', hint: 'Where your applications come from, by job source and company.' },
  { id: 'category', label: 'Category', hint: 'How your applications break down by employment type and category.' },
];

export function InsightsView() {
  const [view, setView] = React.useState<View>('status');

  const { data, isLoading } = useSWR<SankeyData>(
    `/api/insights/sankey?view=${view}`,
    (url: string) => api.get<SankeyData>(url),
  );

  const hint = VIEW_TABS.find((v) => v.id === view)?.hint;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <p className="text-sm text-muted-foreground">
          A Sankey view of your applications. {hint}
        </p>
      </div>

      <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === t.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading && (
          <div className="h-[480px] flex items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {!isLoading && data?.empty && (
          <div className="h-[480px] flex flex-col items-center justify-center text-center px-6">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No applications yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
              Once you start applying, the Sankey diagram here will show how your applications flow through stages, sources, and categories.
            </p>
          </div>
        )}

        {!isLoading && data && !data.empty && (
          <SankeyChart data={data} />
        )}
      </div>
    </div>
  );
}

function SankeyChart({ data }: { data: SankeyData }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const textColor = isDark ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 55)';
  const lineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <div style={{ height: 520 }}>
      <ResponsiveSankey
        data={data}
        margin={{ top: 20, right: 160, bottom: 20, left: 90 }}
        align="justify"
        colors={{ scheme: isDark ? 'nivo' : 'category10' }}
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.35}
        nodeThickness={14}
        nodeSpacing={20}
        nodeBorderWidth={0}
        nodeBorderRadius={3}
        linkOpacity={0.5}
        linkHoverOthersOpacity={0.1}
        linkContract={2}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={12}
        labelTextColor={textColor}
        animate
        theme={{
          background: 'transparent',
          text: { fill: textColor, fontSize: 12 },
          tooltip: {
            container: {
              background: isDark ? 'rgb(24, 24, 27)' : 'white',
              color: textColor,
              fontSize: 12,
              border: `1px solid ${lineColor}`,
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        }}
      />
    </div>
  );
}
