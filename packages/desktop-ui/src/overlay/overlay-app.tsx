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
  const polishing = phase === 'polishing';
  const noSpeech = phase === 'no_speech';
  const failed = phase === 'failed';
  const pillVisualClass = failed
    ? 'h-(--overlay-active-height) w-(--overlay-active-width) border-accent-red/36 bg-[rgba(63,32,45,0.96)] shadow-[0_8px_24px_rgba(0,0,0,0.3)]'
    : isIdle
      ? 'h-(--overlay-idle-height) w-(--overlay-idle-width) border-white/8 bg-canvas shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
    : 'h-(--overlay-active-height) w-(--overlay-active-width) border-white/8 bg-canvas/95 shadow-[0_8px_24px_rgba(0,0,0,0.3)]';

  return (
    <main
      className="flex h-screen w-screen flex-col items-center justify-end pb-(--overlay-bottom-inset)"
      style={overlayGeometryStyle}
      aria-label={isIdle ? 'Toph ready' : 'Toph active'}
    >
      {/* The Electron overlay window sits flush to the screen bottom; keep the
      visible pill bottom-anchored so active growth expands upward. */}
      <section
        className={`flex items-center justify-center overflow-hidden rounded-full border backdrop-blur-xl transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${pillVisualClass}`}
        aria-hidden={isIdle}
      >
        <div className={`flex h-full w-full items-center gap-(--overlay-content-gap) pl-(--overlay-content-padding-left) transition-[opacity,visibility] duration-200 ease-out ${isIdle ? 'invisible opacity-0 delay-0' : 'visible opacity-100 delay-150'}`}>
          <div className="flex size-(--overlay-activity-slot-size) shrink-0 items-center justify-center">
            {failed ? (
              <span className="size-3.5 rounded-full bg-accent-red" />
            ) : noSpeech ? (
              <span className="size-3.5 rounded-full bg-accent-amber" />
            ) : listening ? (
              <div className="flex h-3.5 items-center gap-[3px]" aria-hidden="true">
                <span className="h-2 w-1 animate-wave rounded-full bg-text-primary" />
                <span className="h-3 w-1 animate-wave rounded-full bg-text-primary [animation-delay:0.12s]" />
                <span className="h-3.5 w-1 animate-wave rounded-full bg-text-primary [animation-delay:0.24s]" />
                <span className="h-2.5 w-1 animate-wave rounded-full bg-text-primary [animation-delay:0.36s]" />
              </div>
            ) : (
              <span className="size-4 animate-spin-ring rounded-full border-[2px] border-text-tertiary/20 border-t-text-primary" />
            )}
          </div>

          <h2 className="m-0 w-(--overlay-text-slot-width) text-left text-[0.92rem] font-medium tracking-tight whitespace-nowrap text-text-primary">
            {failed ? 'Failed' : noSpeech ? 'No speech detected' : listening ? 'Listening...' : polishing ? 'Polishing...' : 'Transcribing...'}
          </h2>
        </div>
      </section>
    </main>
  );
}
