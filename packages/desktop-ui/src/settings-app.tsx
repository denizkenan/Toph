import { useEffect, useState } from 'react';

import { SHORTCUT_PRESETS, type DesktopApi } from '@toph/desktop-contracts';

import { useDerivedStatus, useDesktopState } from './hooks';

export function SettingsApp({ client }: { client: DesktopApi }) {
  const state = useDesktopState(client);
  const derived = useDerivedStatus(state);
  const [selectedPresetId, setSelectedPresetId] = useState(state.shortcut.presetId);

  useEffect(() => {
    setSelectedPresetId(state.shortcut.presetId);
  }, [state.shortcut.presetId]);

  const phaseLabel =
    state.phase === 'listening'
      ? 'Listening'
      : state.phase === 'transcribing'
        ? 'Transcribing'
        : 'Idle';

  const primaryActionLabel =
    state.phase === 'listening' ? 'Stop mock capture' : 'Start mock capture';
  const shortcutDirty = selectedPresetId !== state.shortcut.presetId;

  return (
    <main className="settings-shell">
      <div className="settings-backdrop" aria-hidden="true" />

      <section className="settings-simple">
        <header className="panel simple-header">
          <div className="simple-header-copy">
            <span className="eyebrow">Background dictation mock</span>
            <h1>Toph</h1>
            <p>
              Toph starts in the background. Use the tray icon or press{' '}
              <kbd>{state.shortcut.label}</kbd> to show the overlay and run the mock dictation flow.
            </p>
          </div>

          <div className="simple-header-actions">
            <div className="phase-pill" data-phase={state.phase}>
              <span className="phase-dot" />
              {phaseLabel}
            </div>

            <button className="primary-button" onClick={() => void client.toggleCapture()}>
              {primaryActionLabel}
            </button>
            <button className="secondary-button" onClick={() => void client.hideSettings()}>
              Hide to tray
            </button>
          </div>
        </header>

        <section className="simple-grid">
          <article className="panel settings-card">
            <header className="card-header">
              <div>
                <span className="panel-title">Shortcut</span>
                <h2>Change the trigger</h2>
              </div>
              <span className={`status-chip ${derived.shortcutStatus}`}>
                {state.shortcut.registered ? 'Active' : 'Needs attention'}
              </span>
            </header>

            <div className="field-stack">
              <label htmlFor="shortcut-preset">Shortcut preset</label>
              <select
                id="shortcut-preset"
                className="field-input"
                value={selectedPresetId}
                onChange={(event) =>
                  setSelectedPresetId(event.target.value as (typeof SHORTCUT_PRESETS)[number]['id'])
                }
              >
                {SHORTCUT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-actions">
              <button
                className="primary-button"
                onClick={() => void client.installShortcut(selectedPresetId)}
                disabled={
                  (!shortcutDirty && state.shortcut.installed) || !state.shortcut.installable
                }
              >
                {shortcutDirty || !state.shortcut.installed
                  ? 'Apply shortcut'
                  : 'Shortcut installed'}
              </button>
              <span className={`status-chip ${derived.shortcutBackendTone}`}>
                {state.shortcut.backend}
              </span>
            </div>

            <p className="muted-copy">Current shortcut: {state.shortcut.label}</p>
            <p className="muted-copy">{state.shortcut.detail}</p>
          </article>

          <article className="panel settings-card">
            <header>
              <div>
                <span className="panel-title">Runtime</span>
                <h2>Status and environment</h2>
              </div>
              <span className={`status-chip ${derived.pasteStatusTone}`}>
                {state.lastPasteAttempt.status}
              </span>
            </header>

            <dl className="data-list">
              <div>
                <dt>Desktop</dt>
                <dd>{state.environment.currentDesktop}</dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>{state.environment.sessionType}</dd>
              </div>
              <div>
                <dt>Last update</dt>
                <dd>{derived.lastUpdated}</dd>
              </div>
            </dl>

            <p className="muted-copy runtime-copy">{state.pasteSupport.detail}</p>
            <p className="muted-copy">{state.lastPasteAttempt.detail}</p>
          </article>

          <article className="panel settings-card conversions-card">
            <header className="card-header">
              <div>
                <span className="panel-title">Recent conversions</span>
                <h2>Last dictated results</h2>
              </div>
            </header>

            {state.recentConversions.length > 0 ? (
              <div className="conversion-list">
                {state.recentConversions.map((conversion) => (
                  <article key={conversion.id} className="conversion-item">
                    <div className="conversion-meta">
                      <span>
                        {new Date(conversion.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className={`status-chip ${conversion.pasteStatus === 'success' ? 'good' : conversion.pasteStatus === 'failed' ? 'warn' : 'muted'}`}
                      >
                        {conversion.pasteStatus}
                      </span>
                    </div>
                    <p>{conversion.text}</p>
                    <span className="muted-copy">{conversion.pasteDetail}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No conversions yet.</p>
                <span className="muted-copy">
                  Run the mock flow once and the latest dictated text will show up here.
                </span>
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
