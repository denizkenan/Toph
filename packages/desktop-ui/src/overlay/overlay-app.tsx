import type { DesktopApi } from '@toph/desktop-contracts';

import { useDesktopState } from '../hooks/use-desktop-state';
import { useOverlaySounds } from '../hooks/use-overlay-sounds';

export function OverlayApp({
  client,
  soundsEnabled = true,
}: {
  client: DesktopApi;
  soundsEnabled?: boolean;
}) {
  const state = useDesktopState(client);
  useOverlaySounds(client, soundsEnabled);

  if (!state || state.phase === 'idle') {
    return (
      <main className="grid h-screen w-screen place-items-center p-3" aria-label="Toph ready">
        <div className="overlay-idle-line" aria-hidden="true">
          <span className="overlay-idle-line-glow" />
        </div>
      </main>
    );
  }

  const listening = state.phase === 'listening';
  const overlayTone = listening ? 'overlay-card-listening' : 'overlay-card-transcribing';
  const ringTone = listening
    ? 'bg-spark shadow-[0_0_18px_rgba(125,196,228,0.9)] animate-pulse-spark'
    : 'border-t-accent-violet border-r-accent-violet/35 animate-spin-fast';

  return (
    <main className="grid h-screen w-screen place-items-center p-3">
      <section
        className={`overlay-card-surface ${overlayTone} grid w-full animate-overlay-rise grid-cols-[auto_1fr_auto] items-center gap-[18px] rounded-[28px] px-5 py-[18px] max-sm:grid-cols-1 max-sm:text-center`}
      >
        <div className="grid size-[52px] place-items-center rounded-[18px] border border-white/8 bg-white/5">
          <span className={`size-[22px] rounded-full border-4 border-transparent ${ringTone}`} />
        </div>

        <div>
          <span className="mb-3.5 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
            Toph mock dictation
          </span>
          <h2 className="m-0 font-display text-[1.28rem] tracking-[-0.03em]">
            {listening ? 'Capturing your thought' : 'Transcribing the pretend audio'}
          </h2>
          <p className="mt-1.5 mb-0 text-[0.96rem] text-text-secondary">
            {listening
              ? 'Press the shortcut again to stop the capture stage.'
              : 'Clipboard is being filled, and a best-effort paste attempt is next.'}
          </p>
        </div>

        <div className="grid min-w-[92px] place-items-center">
          {listening ? (
            <div className="flex h-[38px] items-end gap-1.5" aria-hidden="true">
              <span className="wave-bar-fill h-3.5 w-1.5 animate-wave rounded-full" />
              <span className="wave-bar-fill h-6.5 w-1.5 animate-wave rounded-full [animation-delay:0.12s]" />
              <span className="wave-bar-fill h-9 w-1.5 animate-wave rounded-full [animation-delay:0.24s]" />
              <span className="wave-bar-fill h-[22px] w-1.5 animate-wave rounded-full [animation-delay:0.36s]" />
              <span className="wave-bar-fill h-3.5 w-1.5 animate-wave rounded-full [animation-delay:0.48s]" />
            </div>
          ) : (
            <div className="relative size-[38px]" aria-hidden="true">
              <span className="absolute inset-0 animate-spin-ring rounded-full border-[3px] border-accent-violet/20 border-t-accent-violet" />
              <span className="absolute inset-2.5 animate-breathe rounded-full bg-[radial-gradient(circle,rgba(198,160,246,0.95),rgba(138,173,244,0.4))]" />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
