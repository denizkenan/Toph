import { useEffect, useState } from 'react';

import { type AppState, type DesktopApi } from '@toph/desktop-contracts';

export function useDesktopState(client: DesktopApi) {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    return client.subscribeState((snapshot) => {
      setState(snapshot);
    });
  }, [client]);

  return state;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const deltaMs = now - timestamp;
  const deltaSec = Math.floor(deltaMs / 1000);

  if (deltaSec < 60) {
    return 'just now';
  }

  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) {
    return `${deltaMin} min ago`;
  }

  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) {
    return `${deltaHr} hr${deltaHr > 1 ? 's' : ''} ago`;
  }

  const deltaDays = Math.floor(deltaHr / 24);
  if (deltaDays === 1) {
    return 'yesterday';
  }

  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Returns a human-readable relative time string that updates automatically.
 *
 * Refresh interval: every 30s for items under 1 hour old, every 60s for older items.
 */
export function useRelativeTime(timestamp: number): string {
  const [label, setLabel] = useState(() => formatRelativeTime(timestamp));

  useEffect(() => {
    setLabel(formatRelativeTime(timestamp));

    const ageMs = Date.now() - timestamp;
    const intervalMs = ageMs < 3_600_000 ? 30_000 : 60_000;

    const id = setInterval(() => {
      setLabel(formatRelativeTime(timestamp));
    }, intervalMs);

    return () => clearInterval(id);
  }, [timestamp]);

  return label;
}
