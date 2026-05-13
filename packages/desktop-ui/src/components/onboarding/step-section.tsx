import type { ReactNode } from 'react';

import { StatusText } from './status-text';
import { StepMarker } from './step-marker';

export function StepSection({
  complete,
  marker,
  title,
  status,
  showConnector = false,
  children,
}: {
  complete: boolean;
  marker: ReactNode;
  title: string;
  status: string;
  showConnector?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="relative grid grid-cols-[2.75rem_1fr] gap-5 pb-9 max-[640px]:grid-cols-[2.25rem_1fr] max-[640px]:gap-3.5"
    >
      {showConnector && (
        <span
          className={`absolute top-11 -bottom-1 left-5.25 w-0.5 rounded-full max-[640px]:left-4.25 ${complete ? 'bg-accent-green/22' : 'bg-white/6'}`}
          aria-hidden="true"
        />
      )}
      <StepMarker complete={complete}>{marker}</StepMarker>
      <div className="min-w-0">
        <h2 className="mt-0 mb-1 font-display text-lg font-semibold tracking-tight text-text-primary">
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
