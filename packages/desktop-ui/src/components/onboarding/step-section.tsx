import type { ReactNode } from 'react';

import { StatusText } from './status-text';
import { StepMarker } from './step-marker';

export function StepSection({
  complete,
  marker,
  title,
  status,
  children,
}: {
  complete: boolean;
  marker: ReactNode;
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`relative grid grid-cols-[2.75rem_1fr] gap-5 pb-9 max-[640px]:grid-cols-[2.25rem_1fr] max-[640px]:gap-3.5 ${complete ? 'onboarding-step-complete' : ''}`}
    >
      <StepMarker complete={complete}>{marker}</StepMarker>
      <div className="min-w-0">
        <h2 className="mt-0 mb-1 font-display text-lg font-semibold tracking-[-0.025em] text-text-primary">
          {title}
        </h2>
        <div className="mb-4">
          <StatusText complete={complete}>{status}</StatusText>
        </div>
        {children}
      </div>
    </section>
  );
}
