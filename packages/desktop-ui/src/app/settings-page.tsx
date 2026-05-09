import { useState } from 'react';

import { Select } from '@base-ui/react/select';
import {
  resolveShortcutPresetForPlatform,
  SHORTCUT_PRESETS,
  type AppState,
  type DesktopApi,
  type ProviderId,
  type ShortcutPresetId,
} from '@toph/desktop-contracts';

const statusToneClasses: Record<string, string> = {
  ready: 'text-accent-green',
  good: 'text-accent-green',
  blocked: 'text-accent-red',
  warn: 'text-accent-red',
  muted: 'text-text-secondary',
  idle: 'text-text-secondary',
};

const buttonClass =
  'inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent px-5 py-3 text-sm font-semibold transition-[transform,border-color,background-color,opacity] duration-200 ease-out hover:-translate-y-px hover:scale-[1.01] disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:scale-100';

export function SettingsPage({
  state,
  client,
  onBack,
}: {
  state: AppState;
  client: DesktopApi;
  onBack: () => void;
}) {
  const [presetOverride, setPresetOverride] = useState<ShortcutPresetId | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [busyPolish, setBusyPolish] = useState(false);
  const [busySettings, setBusySettings] = useState(false);
  const selectedPresetId = presetOverride ?? state.shortcut.presetId;
  const shortcutDirty = selectedPresetId !== state.shortcut.presetId;
  const shortcutTone = state.shortcut.registered ? 'ready' : 'blocked';
  const shortcutToneClass = statusToneClasses[shortcutTone] ?? statusToneClasses.idle;

  const presetItems = SHORTCUT_PRESETS.map((preset) => ({
    value: preset.id,
    label: resolveShortcutPresetForPlatform(preset.id, state.environment.platform).label,
  }));
  const provider = state.providers.providers[0];
  const providerConnected = provider?.status === 'connected';
  const providerItems = state.providers.providers.map((item) => ({
    value: item.id,
    label: item.label,
  }));
  const settingsEditable = state.phase === 'idle';
  const polishPromptItems = state.polish.prompts.map((prompt) => ({
    value: prompt.id,
    label: prompt.title,
  }));

  const connectProvider = async () => {
    if (!provider) {
      return;
    }

    setBusyProvider(provider.id);
    try {
      await client.connectProvider(provider.id);
    } catch {
      // Main process publishes provider errors into AppState.
    } finally {
      setBusyProvider(null);
    }
  };

  const removeProvider = async () => {
    if (!provider) {
      return;
    }

    setBusyProvider(provider.id);
    try {
      await client.removeProvider(provider.id);
    } finally {
      setBusyProvider(null);
    }
  };

  const setPolishEnabled = async (enabled: boolean) => {
    setBusyPolish(true);
    try {
      await client.setPolishEnabled(enabled);
    } finally {
      setBusyPolish(false);
    }
  };

  const updateSetting = async (action: () => Promise<void>) => {
    setBusySettings(true);
    try {
      await action();
    } finally {
      setBusySettings(false);
    }
  };

  const setActivePolishPrompt = async (promptId: string) => {
    setBusyPolish(true);
    try {
      await client.setActivePolishPrompt(promptId);
    } finally {
      setBusyPolish(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-10 pt-12 pb-10 max-[980px]:px-6 max-[980px]:pb-6">
      {state.environment.platform === 'darwin' && (
        <div className="window-drag-region fixed top-0 right-0 left-0 h-10" aria-hidden="true" />
      )}
      <div className="settings-backdrop-wash pointer-events-none absolute -inset-[10%]" aria-hidden="true" />

        <section className="relative mx-auto max-w-[720px]">
        <header className="mb-8 flex items-center gap-4">
          <button
            type="button"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-secondary transition-all duration-200 ease-out hover:-translate-y-px hover:bg-white/8 hover:text-text-primary"
            onClick={onBack}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4L6 9L11 14" />
            </svg>
          </button>
          <h1 className="m-0 font-display text-2xl tracking-[-0.03em]">Settings</h1>
        </header>

        <section className="panel-surface mb-5 rounded-3xl p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <span className="mb-2 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
                Providers
              </span>
              <h2 className="m-0 font-display text-xl tracking-[-0.03em]">Transcription engine</h2>
            </div>
            {provider && (
              <span className={`inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3.5 py-2 text-sm ${providerConnected ? 'text-accent-green' : 'text-accent-amber'}`}>
                <span className={`size-2 rounded-full ${providerConnected ? 'bg-accent-green' : 'bg-accent-amber'}`} />
                {providerConnected ? 'Connected' : 'Needs setup'}
              </span>
            )}
          </div>

          {provider && (
            <div className="rounded-3xl border border-white/8 bg-white/4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 font-display text-lg tracking-[-0.025em] text-text-primary">
                    {provider.label}
                  </h3>
                  <p className="mt-1 mb-0 text-sm leading-relaxed text-text-secondary">
                    {provider.description}
                  </p>
                  {provider.accountId && (
                    <p className="mt-3 mb-0 text-xs text-text-tertiary">
                      Account: <span className="font-semibold text-text-secondary">{provider.accountId}</span>
                    </p>
                  )}
                  {provider.error && (
                    <p className="mt-3 mb-0 rounded-2xl border border-accent-red/16 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
                      {provider.error}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`${buttonClass} bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]`}
                    onClick={() => void connectProvider()}
                    disabled={busyProvider !== null || provider.status === 'connecting'}
                  >
                    {providerConnected ? 'Reconnect' : 'Connect'}
                  </button>
                  <button
                    type="button"
                    className={`${buttonClass} border-accent-red/20 bg-accent-red/10 text-accent-red hover:bg-accent-red/18`}
                    onClick={() => void removeProvider()}
                    disabled={busyProvider !== null || !providerConnected}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="panel-surface mb-5 rounded-3xl p-6">
          <div className="mb-5">
            <span className="mb-2 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
              Models
            </span>
            <h2 className="m-0 font-display text-xl tracking-[-0.03em]">Provider routing</h2>
            <p className="mt-2 mb-0 text-sm leading-relaxed text-text-secondary">
              Choose which provider and model Toph uses for auth, transcription, and inference.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm text-text-secondary">Auth provider</label>
              <Select.Root
                items={providerItems}
                value={state.settings.auth.providerId}
                onValueChange={(value) => {
                  if (value) void updateSetting(() => client.setAuthProvider(value as ProviderId));
                }}
              >
                <Select.Trigger className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary transition-colors duration-150 hover:bg-white/6 data-[popup-open]:bg-white/6 disabled:opacity-55" disabled={!settingsEditable || busySettings}>
                  <Select.Value placeholder="Select auth provider" />
                  <Select.Icon className="text-text-tertiary"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4L5 7L8 4" /></svg></Select.Icon>
                </Select.Trigger>
                <Select.Portal><Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}><Select.Popup className="menu-popup-surface origin-[var(--transform-origin)] rounded-xl py-1.5 transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"><Select.List>{providerItems.map((item) => <Select.Item key={item.value} value={item.value} className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8"><Select.ItemText>{item.label}</Select.ItemText></Select.Item>)}</Select.List></Select.Popup></Select.Positioner></Select.Portal>
              </Select.Root>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[640px]:grid-cols-1">
              <div>
                <label className="mb-2 block text-sm text-text-secondary">Transcription provider</label>
                <Select.Root items={providerItems} value={state.settings.transcription.providerId} onValueChange={(value) => { if (value) void updateSetting(() => client.setTranscriptionProvider(value as ProviderId)); }}>
                  <Select.Trigger className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary transition-colors duration-150 hover:bg-white/6 data-[popup-open]:bg-white/6 disabled:opacity-55" disabled={!settingsEditable || busySettings}>
                    <Select.Value placeholder="Select transcription provider" />
                    <Select.Icon className="text-text-tertiary"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4L5 7L8 4" /></svg></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal><Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}><Select.Popup className="menu-popup-surface origin-[var(--transform-origin)] rounded-xl py-1.5"><Select.List>{providerItems.map((item) => <Select.Item key={item.value} value={item.value} className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8"><Select.ItemText>{item.label}</Select.ItemText></Select.Item>)}</Select.List></Select.Popup></Select.Positioner></Select.Portal>
                </Select.Root>
              </div>
              <div>
                <label className="mb-2 block text-sm text-text-secondary">Transcription model</label>
                <input className="h-12 w-full rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary outline-hidden transition-colors duration-150 hover:bg-white/6 focus:bg-white/6 disabled:opacity-55" value={state.settings.transcription.model} disabled={!settingsEditable} onChange={(event) => void updateSetting(() => client.setTranscriptionModel(event.currentTarget.value))} />
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[640px]:grid-cols-1">
              <div>
                <label className="mb-2 block text-sm text-text-secondary">Inference provider</label>
                <Select.Root items={providerItems} value={state.settings.inference.providerId} onValueChange={(value) => { if (value) void updateSetting(() => client.setInferenceProvider(value as ProviderId)); }}>
                  <Select.Trigger className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary transition-colors duration-150 hover:bg-white/6 data-[popup-open]:bg-white/6 disabled:opacity-55" disabled={!settingsEditable || busySettings}>
                    <Select.Value placeholder="Select inference provider" />
                    <Select.Icon className="text-text-tertiary"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4L5 7L8 4" /></svg></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal><Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}><Select.Popup className="menu-popup-surface origin-[var(--transform-origin)] rounded-xl py-1.5"><Select.List>{providerItems.map((item) => <Select.Item key={item.value} value={item.value} className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8"><Select.ItemText>{item.label}</Select.ItemText></Select.Item>)}</Select.List></Select.Popup></Select.Positioner></Select.Portal>
                </Select.Root>
              </div>
              <div>
                <label className="mb-2 block text-sm text-text-secondary">Inference model</label>
                <input className="h-12 w-full rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary outline-hidden transition-colors duration-150 hover:bg-white/6 focus:bg-white/6 disabled:opacity-55" value={state.settings.inference.model} disabled={!settingsEditable} onChange={(event) => void updateSetting(() => client.setInferenceModel(event.currentTarget.value))} />
              </div>
            </div>
          </div>
        </section>

        <section className="panel-surface mb-5 rounded-3xl p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <span className="mb-2 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
                Polish
              </span>
              <h2 className="m-0 font-display text-xl tracking-[-0.03em]">Clean up before paste</h2>
              <p className="mt-2 mb-0 text-sm leading-relaxed text-text-secondary">
                Polish uses inference after transcription to preserve your voice while fixing dictation artifacts.
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3.5 py-2 text-sm ${state.settings.polish.enabled ? 'text-accent-green' : 'text-text-secondary'}`}>
              <span className={`size-2 rounded-full ${state.settings.polish.enabled ? 'bg-accent-green' : 'bg-white/20'}`} />
              {state.settings.polish.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/8 bg-white/4 p-4">
            <div>
              <h3 className="m-0 font-display text-lg tracking-[-0.025em] text-text-primary">
                Polish dictation
              </h3>
              <p className="mt-1 mb-0 text-sm leading-relaxed text-text-secondary">
                When disabled, Toph pastes the raw assembled transcript.
              </p>
            </div>
            <button
              type="button"
              className={`${buttonClass} ${state.settings.polish.enabled ? 'border-white/10 bg-white/6 text-text-primary hover:bg-white/10' : 'bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]'}`}
              onClick={() => void setPolishEnabled(!state.settings.polish.enabled)}
              disabled={!settingsEditable || busyPolish}
            >
              {state.settings.polish.enabled ? 'Disable Polish' : 'Enable Polish'}
            </button>
          </div>

          <div>
            <label className="mb-2 block text-sm text-text-secondary">Prompt</label>
            <Select.Root
              items={polishPromptItems}
              value={state.settings.polish.promptId}
              onValueChange={(value) => {
                if (settingsEditable && value && value !== state.settings.polish.promptId) {
                  void setActivePolishPrompt(value);
                }
              }}
            >
              <Select.Trigger className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary transition-colors duration-150 hover:bg-white/6 data-[popup-open]:bg-white/6 disabled:opacity-55" disabled={!settingsEditable || busyPolish}>
                <Select.Value placeholder="Select prompt" />
                <Select.Icon className="text-text-tertiary">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4L5 7L8 4" />
                  </svg>
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}>
                  <Select.Popup className="menu-popup-surface origin-[var(--transform-origin)] rounded-xl py-1.5 transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                    <Select.List>
                      {polishPromptItems.map((item) => (
                        <Select.Item
                          key={item.value}
                          value={item.value}
                          className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8"
                        >
                          <Select.ItemIndicator className="text-accent-green">
                            <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                              <path d="M9.16 1.12a.75.75 0 0 1 .22 1.04L5.14 8.66a.75.75 0 0 1-1.13.13L1.25 6.31a.75.75 0 1 1 1.06-1.06l2.1 1.91L8.12 1.34a.75.75 0 0 1 1.04-.22Z" />
                            </svg>
                          </Select.ItemIndicator>
                          <Select.ItemText>{item.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <p className="mt-3 mb-0 text-xs text-text-tertiary">
              Active prompt ID: <span className="font-semibold text-text-secondary">{state.settings.polish.promptId}</span>
            </p>
          </div>
        </section>

        <section className="panel-surface mb-5 rounded-3xl p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <span className="mb-2 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
                Shortcut
              </span>
              <h2 className="m-0 font-display text-xl tracking-[-0.03em]">Change the trigger</h2>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3.5 py-2 text-sm ${shortcutToneClass}`}>
              <span className={`size-2 rounded-full ${state.shortcut.registered ? 'bg-accent-green' : 'bg-accent-red'}`} />
              {state.shortcut.registered ? 'Active' : 'Needs attention'}
            </span>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm text-text-secondary">Shortcut preset</label>
            <Select.Root
              items={presetItems}
              value={selectedPresetId}
              onValueChange={(value) => {
                if (value) {
                  setPresetOverride(value as ShortcutPresetId);
                }
              }}
            >
              <Select.Trigger className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary transition-colors duration-150 hover:bg-white/6 data-[popup-open]:bg-white/6">
                <Select.Value placeholder="Select preset" />
                <Select.Icon className="text-text-tertiary">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4L5 7L8 4" />
                  </svg>
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}>
                  <Select.Popup className="menu-popup-surface origin-[var(--transform-origin)] rounded-xl py-1.5 transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                    <Select.List>
                      {presetItems.map((item) => (
                        <Select.Item
                          key={item.value}
                          value={item.value}
                          className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8"
                        >
                          <Select.ItemIndicator className="text-accent-green">
                            <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                              <path d="M9.16 1.12a.75.75 0 0 1 .22 1.04L5.14 8.66a.75.75 0 0 1-1.13.13L1.25 6.31a.75.75 0 1 1 1.06-1.06l2.1 1.91L8.12 1.34a.75.75 0 0 1 1.04-.22Z" />
                            </svg>
                          </Select.ItemIndicator>
                          <Select.ItemText>{item.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`${buttonClass} bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]`}
              onClick={() => void client.installShortcut(selectedPresetId)}
              disabled={(!shortcutDirty && state.shortcut.installed) || !state.shortcut.installable}
            >
              {shortcutDirty || !state.shortcut.installed ? 'Apply shortcut' : 'Shortcut installed'}
            </button>
            <span className="text-sm text-text-secondary">
              Backend: {state.shortcut.backend}
            </span>
          </div>

          <p className="mt-4 mb-0 text-sm text-text-secondary">{state.shortcut.detail}</p>
        </section>

        <section className="panel-surface mb-5 rounded-3xl p-6">
          <span className="mb-2 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
            Runtime
          </span>
          <h2 className="m-0 mb-4 font-display text-xl tracking-[-0.03em]">Environment</h2>

          <dl className="grid gap-3">
            <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
              <dt className="text-text-tertiary">Desktop</dt>
              <dd className="m-0 text-sm font-semibold">{state.environment.currentDesktop || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
              <dt className="text-text-tertiary">Session</dt>
              <dd className="m-0 text-sm font-semibold">{state.environment.sessionType || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
              <dt className="text-text-tertiary">Platform</dt>
              <dd className="m-0 text-sm font-semibold">{state.environment.platform}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
              <dt className="text-text-tertiary">Provider</dt>
              <dd className="m-0 text-sm font-semibold">{state.providers.ready ? 'Ready' : 'Needs setup'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
              <dt className="text-text-tertiary">Polish</dt>
              <dd className="m-0 text-sm font-semibold">{state.settings.polish.enabled ? state.settings.polish.promptId : 'Disabled'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/6 pb-3">
              <dt className="text-text-tertiary">Permissions</dt>
              <dd className="m-0 text-sm font-semibold">{state.permissions.ready ? 'Ready' : 'Needs setup'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-tertiary">Paste support</dt>
              <dd className="m-0 text-sm font-semibold">{state.pasteSupport.helper ?? 'None'}</dd>
            </div>
          </dl>

          {state.pasteSupport.detail && (
            <p className="mt-4 mb-0 text-sm text-text-secondary">{state.pasteSupport.detail}</p>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            className={`${buttonClass} border-accent-red/20 bg-accent-red/10 text-accent-red hover:bg-accent-red/18`}
            onClick={() => void client.quit()}
          >
            Quit Toph
          </button>
        </div>
      </section>
    </main>
  );
}
