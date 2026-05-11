import type { ReactNode } from 'react';

export function StepMarker({ complete, children }: { complete: boolean; children: ReactNode }) {
  return (
    <div
      className={`relative z-1 grid size-11 shrink-0 place-items-center rounded-[0.875rem] border transition-colors duration-300 ${complete ? 'border-accent-green/18 bg-accent-green/8 text-accent-green' : 'border-accent-blue/18 bg-accent-blue/8 text-accent-blue'}`}
    >
      {children}
    </div>
  );
}
