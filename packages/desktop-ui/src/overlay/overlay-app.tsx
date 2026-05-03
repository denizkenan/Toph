import type { CSSProperties } from 'react';

import type { DesktopApi } from '@toph/desktop-contracts';

import { useDesktopState } from '../hooks/use-desktop-state';
import { useOverlaySounds } from '../hooks/use-overlay-sounds';

// Renderer-owned visual dimensions. Keep these within OVERLAY_WINDOW_GEOMETRY
// from desktop-contracts so the transparent Electron window can stay fixed.
const overlayRendererGeometry = {
  bottomInset: 8,
  pill: {
    idle: {
      width: 72,
      height: 8,
    },
    active: {
      width: 164,
      height: 44,
    },
  },
  content: {
    paddingLeft: 20,
    gap: 12,
    activitySlotSize: 20,
    textSlotWidth: 100,
  },
} as const;

const overlayGeometryStyle = {
  '--overlay-bottom-inset': `${overlayRendererGeometry.bottomInset}px`,
  '--overlay-idle-width': `${overlayRendererGeometry.pill.idle.width}px`,
  '--overlay-idle-height': `${overlayRendererGeometry.pill.idle.height}px`,
  '--overlay-active-width': `${overlayRendererGeometry.pill.active.width}px`,
  '--overlay-active-height': `${overlayRendererGeometry.pill.active.height}px`,
  '--overlay-content-padding-left': `${overlayRendererGeometry.content.paddingLeft}px`,
  '--overlay-content-gap': `${overlayRendererGeometry.content.gap}px`,
  '--overlay-activity-slot-size': `${overlayRendererGeometry.content.activitySlotSize}px`,
  '--overlay-text-slot-width': `${overlayRendererGeometry.content.textSlotWidth}px`,
} as CSSProperties;

export function OverlayApp({
  client,
  soundsEnabled = true,
}: {
  client: DesktopApi;
  soundsEnabled?: boolean;
}) {
  const state = useDesktopState(client);
  useOverlaySounds(client, soundsEnabled);

  const phase = state?.phase || 'idle';
  const isIdle = phase === 'idle';
  const listening = phase === 'listening';

  return (
    <main
      className="overlay-viewport"
      style={overlayGeometryStyle}
      aria-label={isIdle ? 'Toph ready' : 'Toph active'}
    >
      {/* The Electron overlay window sits flush to the screen bottom; keep the
      visible pill bottom-anchored so active growth expands upward. */}
      <section
        className={`overlay-pill-container ${isIdle ? 'pill-idle' : 'pill-active'}`}
        aria-hidden={isIdle}
      >
        <div className="pill-content">
          <div className="pill-activity-slot">
            {listening ? (
              <div className="flex h-3.5 items-center gap-[3px]" aria-hidden="true">
                <span className="wave-bar-minimal h-2 w-1 animate-wave rounded-full" />
                <span className="wave-bar-minimal h-3 w-1 animate-wave rounded-full [animation-delay:0.12s]" />
                <span className="wave-bar-minimal h-3.5 w-1 animate-wave rounded-full [animation-delay:0.24s]" />
                <span className="wave-bar-minimal h-2.5 w-1 animate-wave rounded-full [animation-delay:0.36s]" />
              </div>
            ) : (
              <span className="size-4 animate-spin-ring rounded-full border-[2px] border-text-tertiary/20 border-t-text-primary" />
            )}
          </div>

          <h2 className="pill-text m-0 text-left whitespace-nowrap text-[0.92rem] font-medium tracking-tight text-text-primary">
            {listening ? 'Listening...' : 'Transcribing...'}
          </h2>
        </div>
      </section>
    </main>
  );
}
