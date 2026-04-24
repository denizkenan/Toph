import { useEffect, useState } from 'react';

import {
  DEFAULT_SHORTCUT_PRESET,
  SHORTCUT_PRESETS,
  type DesktopApi,
  type ShortcutPresetId,
} from '@toph/desktop-contracts';

import { useDerivedStatus, useDesktopState } from './hooks';

const panelClass = 'panel-surface relative';
const headingClass = 'm-0 font-display tracking-[-0.03em]';
const eyebrowClass = 'mb-3.5 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase';
const buttonClass =
  'inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent px-5 py-3 transition-[transform,border-color,background-color,opacity] duration-200 ease-out hover:-translate-y-px hover:scale-[1.01] disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:scale-100';
const primaryButtonClass = `${buttonClass} bg-linear-to-br from-accent-blue to-accent-violet font-bold text-[#11131f]`;
const secondaryButtonClass = `${buttonClass} border-white/8 bg-white/4 text-text-primary`;
const fieldInputClass =
  'w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-text-primary';

const statusToneClasses = {
  ready: 'text-accent-green',
  good: 'text-accent-green',
  blocked: 'text-accent-red',
  warn: 'text-accent-red',
  muted: 'text-text-secondary',
  idle: 'text-text-secondary',
};

function statusChipClass(tone: string) {
  const toneClass = statusToneClasses[tone as keyof typeof statusToneClasses] ?? statusToneClasses.idle;

  return `inline-flex items-center gap-2.5 self-start rounded-full border border-white/8 bg-white/5 px-3.5 py-2 ${toneClass}`;
}

export function SettingsApp({ client }: { client: DesktopApi }) {
  const state = useDesktopState(client);
  const derived = useDerivedStatus(state);
  const [selectedPresetId, setSelectedPresetId] = useState<ShortcutPresetId>(
    DEFAULT_SHORTCUT_PRESET.id,
  );

  useEffect(() => {
    if (state) {
      setSelectedPresetId(state.shortcut.presetId);
    }
  }, [state?.shortcut.presetId]);

  if (!state) {
    return (
      <main className="relative min-h-screen overflow-hidden p-10 max-[980px]:p-6">
        <div className="settings-backdrop-wash pointer-events-none absolute -inset-[10%]" aria-hidden="true" />

        <section className="relative mx-auto max-w-[1080px]">
          <header className={`${panelClass} mb-5 flex items-start justify-between gap-6 rounded-3xl p-6 max-[980px]:flex-col`}>
            <div>
              <span className={eyebrowClass}>Background dictation mock</span>
              <h1 className={`${headingClass} text-[2.6rem]`}>Toph</h1>
              <p className="mt-3 mb-0 max-w-[60ch] text-text-secondary">
                Connecting the settings UI to the desktop runtime...
              </p>
            </div>
          </header>
        </section>
      </main>
    );
  }

  const phaseLabel =
    state.phase === 'listening'
      ? 'Listening'
      : state.phase === 'transcribing'
        ? 'Transcribing'
        : 'Idle';

  const primaryActionLabel =
    state.phase === 'listening' ? 'Stop mock capture' : 'Start mock capture';
  const shortcutDirty = selectedPresetId !== state.shortcut.presetId;
  const phasePillClass =
    state.phase === 'listening'
      ? 'bg-spark/14'
      : state.phase === 'transcribing'
        ? 'bg-accent-violet/14'
        : 'bg-white/5';

  return (
    <main className="relative min-h-screen overflow-hidden p-10 max-[980px]:p-6">
      <div className="settings-backdrop-wash pointer-events-none absolute -inset-[10%]" aria-hidden="true" />

      <section className="relative mx-auto max-w-[1080px]">
        <header className={`${panelClass} mb-5 flex items-start justify-between gap-6 rounded-3xl p-6 max-[980px]:flex-col`}>
          <div>
            <span className={eyebrowClass}>Background dictation mock</span>
            <h1 className={`${headingClass} text-[2.6rem]`}>Toph</h1>
            <p className="mt-3 mb-0 max-w-[60ch] text-text-secondary">
              Toph starts in the background. Use the tray icon or press{' '}
              <kbd className="rounded-full border border-white/14 bg-white/5 px-2.5 py-1 text-[0.9rem] text-text-primary">
                {state.shortcut.label}
              </kbd>{' '}
              to show the overlay and run the mock dictation flow.
            </p>
          </div>

          <div className="flex min-w-[280px] flex-wrap items-center justify-end gap-3 max-[980px]:min-w-0 max-[980px]:justify-start">
            <div className={`inline-flex items-center gap-2.5 self-start rounded-full border border-white/8 px-3.5 py-2 ${phasePillClass}`}>
              <span className="size-2.5 rounded-full bg-spark shadow-[0_0_18px_rgba(125,196,228,0.9)]" />
              {phaseLabel}
            </div>

            <button className={primaryButtonClass} onClick={() => void client.toggleCapture()}>
              {primaryActionLabel}
            </button>
            <button className={secondaryButtonClass} onClick={() => void client.hideSettings()}>
              Hide to tray
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-5 max-[980px]:grid-cols-1">
          <article className={`${panelClass} grid gap-[18px] rounded-3xl p-6`}>
            <header className="flex items-start justify-between gap-4">
              <div>
                <span className={eyebrowClass}>Shortcut</span>
                <h2 className={`${headingClass} text-xl`}>Change the trigger</h2>
              </div>
              <span className={statusChipClass(derived.shortcutStatus)}>
                {state.shortcut.registered ? 'Active' : 'Needs attention'}
              </span>
            </header>

            <div className="grid gap-2.5">
              <label className="text-text-secondary" htmlFor="shortcut-preset">
                Shortcut preset
              </label>
              <select
                id="shortcut-preset"
                className={fieldInputClass}
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

            <div className="flex flex-wrap items-center gap-3">
              <button
                className={primaryButtonClass}
                onClick={() => void client.installShortcut(selectedPresetId)}
                disabled={
                  (!shortcutDirty && state.shortcut.installed) || !state.shortcut.installable
                }
              >
                {shortcutDirty || !state.shortcut.installed
                  ? 'Apply shortcut'
                  : 'Shortcut installed'}
              </button>
              <span className={statusChipClass(derived.shortcutBackendTone)}>
                {state.shortcut.backend}
              </span>
            </div>

            <p className="text-text-secondary">Current shortcut: {state.shortcut.label}</p>
            <p className="text-text-secondary">{state.shortcut.detail}</p>
          </article>

          <article className={`${panelClass} grid gap-[18px] rounded-3xl p-6`}>
            <header className="flex items-start justify-between gap-4">
              <div>
                <span className={eyebrowClass}>Runtime</span>
                <h2 className={`${headingClass} text-xl`}>Status and environment</h2>
              </div>
              <span className={statusChipClass(derived.pasteStatusTone)}>
                {state.lastPasteAttempt.status}
              </span>
            </header>

            <dl className="grid gap-3.5">
              <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
                <dt className="text-text-tertiary">Desktop</dt>
                <dd className="m-0 font-semibold">{state.environment.currentDesktop}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
                <dt className="text-text-tertiary">Session</dt>
                <dd className="m-0 font-semibold">{state.environment.sessionType}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
                <dt className="text-text-tertiary">Last update</dt>
                <dd className="m-0 font-semibold">{derived.lastUpdated}</dd>
              </div>
            </dl>

            <p className="m-0 text-text-secondary">{state.pasteSupport.detail}</p>
            <p className="text-text-secondary">{state.lastPasteAttempt.detail}</p>
          </article>

          <article className={`${panelClass} col-span-full grid gap-[18px] rounded-3xl p-6`}>
            <header className="flex items-start justify-between gap-4">
              <div>
                <span className={eyebrowClass}>Recent conversions</span>
                <h2 className={`${headingClass} text-xl`}>Last dictated results</h2>
              </div>
            </header>

            {state.recentConversions.length > 0 ? (
              <div className="grid gap-3">
                {state.recentConversions.map((conversion) => (
                  <article
                    key={conversion.id}
                    className="grid gap-2.5 rounded-[18px] border border-white/6 bg-white/3 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {new Date(conversion.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className={statusChipClass(
                          conversion.pasteStatus === 'success'
                            ? 'good'
                            : conversion.pasteStatus === 'failed'
                              ? 'warn'
                              : 'muted',
                        )}
                      >
                        {conversion.pasteStatus}
                      </span>
                    </div>
                    <p className="m-0 text-text-primary">{conversion.text}</p>
                    <span className="text-text-secondary">{conversion.pasteDetail}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid gap-1.5 rounded-[18px] border border-dashed border-white/12 bg-white/2 p-[18px]">
                <p className="m-0">No conversions yet.</p>
                <span className="text-text-secondary">
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
