import type { DesktopApi } from '@toph/desktop-contracts';

import { useDesktopState, useOverlaySounds } from './hooks';

export function OverlayApp({
  client,
  soundsEnabled = true,
}: {
  client: DesktopApi;
  soundsEnabled?: boolean;
}) {
  const state = useDesktopState(client);
  useOverlaySounds(client, soundsEnabled);

  if (state.phase === 'idle') {
    return <div className="overlay-root overlay-hidden" />;
  }

  const listening = state.phase === 'listening';

  return (
    <main className="overlay-root">
      <section className={`overlay-card ${listening ? 'listening' : 'transcribing'}`}>
        <div className="overlay-indicator">
          <span className={`indicator-ring ${listening ? 'listening' : 'transcribing'}`} />
        </div>

        <div className="overlay-copy">
          <span className="overlay-label">Toph mock dictation</span>
          <h2>{listening ? 'Capturing your thought' : 'Transcribing the pretend audio'}</h2>
          <p>
            {listening
              ? 'Press the shortcut again to stop the capture stage.'
              : 'Clipboard is being filled, and a best-effort paste attempt is next.'}
          </p>
        </div>

        <div className="overlay-visual">
          {listening ? (
            <div className="wave-bars" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="spinner-shell" aria-hidden="true">
              <span className="spinner-ring" />
              <span className="spinner-core" />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
