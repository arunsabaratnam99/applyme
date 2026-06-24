'use client';

import React from 'react';

export const CompanyLogo = React.memo(function CompanyLogo({ company, size = 40 }: { company: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);

  const logoUrl = `/api/logo?company=${encodeURIComponent(company)}&v=3`;

  React.useEffect(() => { setFailed(false); }, [company]);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
      >
        {company.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden border border-border/40"
    >
      <img
        src={logoUrl}
        alt={company}
        width={size}
        height={size}
        className="object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
});
