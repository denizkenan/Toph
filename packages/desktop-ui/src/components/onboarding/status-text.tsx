import type { ReactNode } from 'react';

export function StatusText({ complete, children }: { complete: boolean; children: ReactNode }) {
  return (
    <span className={`text-xs font-semibold tracking-[0.06em] uppercase ${complete ? 'text-accent-green' : 'text-accent-amber'}`}>
      {children}
    </span>
  );
}
