import { useState } from 'react';

import type {
  DesktopApi,
  PermissionRequirement,
  PermissionRequirementId,
  ProviderConnection,
  ProviderId,
  ProviderState,
} from '@toph/desktop-contracts';

const buttonClass =
  'inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent px-4 py-2 text-sm font-semibold transition-[transform,border-color,background-color,opacity] duration-200 ease-out hover:-translate-y-px disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0';

function getActionLabel(requirement: PermissionRequirement) {
  if (requirement.status === 'granted') {
    return 'Granted';
  }

  if (requirement.action === 'request') {
    return 'Request access';
  }

  return 'Open settings';
}

function getStatusLabel(requirement: PermissionRequirement) {
  if (requirement.status === 'granted') {
    return 'Complete';
  }

  if (requirement.status === 'promptable') {
    return 'Ready to ask';
  }

  if (requirement.status === 'denied') {
    return 'Blocked';
  }

  return 'Needed';
}

function getProviderStatusLabel(provider: ProviderConnection) {
  if (provider.status === 'connected') {
    return 'Connected';
  }
  if (provider.status === 'connecting') {
    return 'Connecting';
  }
  if (provider.status === 'invalid') {
    return 'Reconnect';
  }
  return 'Not added';
}

function PermissionCard({
  requirement,
  busy,
  disabled,
  onAction,
}: {
  requirement: PermissionRequirement;
  busy: boolean;
  disabled: boolean;
  onAction: (permissionId: PermissionRequirementId) => void;
}) {
  const complete = requirement.status === 'granted' || requirement.status === 'not-required';

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border p-5 transition-[transform,border-color,background-color] duration-300 ease-out hover:-translate-y-0.5 ${complete ? 'border-accent-green/24 bg-accent-green/8' : disabled ? 'border-white/6 bg-white/2 opacity-60' : 'border-white/8 bg-white/4 hover:border-white/14'}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-2xl border transition-colors duration-300 ${complete ? 'border-accent-green/28 bg-accent-green/14 text-accent-green' : 'border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan'}`}
        >
          {complete ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 5L7.5 12L3.5 8" />
            </svg>
          ) : (
            <span className="size-2.5 rounded-full bg-current shadow-[0_0_18px_currentColor]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-display text-lg tracking-[-0.025em] text-text-primary">
              {requirement.label}
            </h2>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${complete ? 'border-accent-green/20 bg-accent-green/10 text-accent-green' : 'border-accent-amber/20 bg-accent-amber/10 text-accent-amber'}`}>
              {getStatusLabel(requirement)}
            </span>
          </div>
          <p className="m-0 text-sm leading-relaxed text-text-secondary">
            {requirement.detail}
          </p>
        </div>

        <button
          type="button"
          className={`${buttonClass} shrink-0 ${complete ? 'bg-white/5 text-text-tertiary' : 'bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]'}`}
          onClick={() => onAction(requirement.id)}
          disabled={complete || busy || disabled || requirement.action === 'none'}
        >
          {busy ? 'Checking...' : getActionLabel(requirement)}
        </button>
      </div>
    </article>
  );
}

function ProviderCard({
  providers,
  selectedProviderId,
  busy,
  manualInput,
  onSelectProvider,
  onManualInputChange,
  onConnect,
  onSubmitManual,
}: {
  providers: ProviderConnection[];
  selectedProviderId: ProviderId;
  busy: boolean;
  manualInput: string;
  onSelectProvider: (providerId: ProviderId) => void;
  onManualInputChange: (value: string) => void;
  onConnect: () => void;
  onSubmitManual: () => void;
}) {
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];
  const connected = selectedProvider.status === 'connected';
  const connecting = selectedProvider.status === 'connecting' || busy;

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border p-5 transition-[border-color,background-color] duration-300 ${connected ? 'border-accent-green/24 bg-accent-green/8' : 'border-accent-blue/20 bg-accent-blue/8'}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-2xl border ${connected ? 'border-accent-green/28 bg-accent-green/14 text-accent-green' : 'border-accent-blue/24 bg-accent-blue/12 text-accent-blue'}`}
        >
          {connected ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 5L7.5 12L3.5 8" />
            </svg>
          ) : (
            <span className="size-2.5 rounded-full bg-current shadow-[0_0_18px_currentColor]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-display text-lg tracking-[-0.025em] text-text-primary">
              Add a provider
            </h2>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${connected ? 'border-accent-green/20 bg-accent-green/10 text-accent-green' : 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue'}`}>
              {getProviderStatusLabel(selectedProvider)}
            </span>
          </div>
          <p className="m-0 text-sm leading-relaxed text-text-secondary">
            Pick the transcription engine Toph should use. I only have one plug-in brain today; future me is leaving room for more.
          </p>

          <label className="mt-4 mb-2 block text-xs font-bold tracking-[0.14em] text-text-tertiary uppercase">
            Provider
          </label>
          <select
            className="h-11 w-full rounded-2xl border border-white/8 bg-canvas-elevated px-3 text-sm text-text-primary outline-none transition-colors duration-150 hover:bg-white/6 focus:border-accent-blue/40"
            value={selectedProviderId}
            onChange={(event) => onSelectProvider(event.target.value as ProviderId)}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>

          {selectedProvider.error && (
            <p className="mt-3 mb-0 rounded-2xl border border-accent-red/16 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
              {selectedProvider.error}
            </p>
          )}

          {connecting && (
            <div className="mt-4 grid gap-2 rounded-2xl border border-white/8 bg-white/4 p-3">
              <p className="m-0 text-sm text-text-secondary">
                Waiting for browser authorization. If localhost gets grumpy, paste the redirect URL or code here.
              </p>
              <div className="flex gap-2 max-[640px]:flex-col">
                <input
                  className="min-w-0 flex-1 rounded-full border border-white/8 bg-canvas px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-tertiary focus:border-accent-blue/40"
                  value={manualInput}
                  onChange={(event) => onManualInputChange(event.target.value)}
                  placeholder="Authorization URL or code"
                />
                <button
                  type="button"
                  className={`${buttonClass} border-white/8 bg-white/5 text-text-primary hover:bg-white/9`}
                  onClick={onSubmitManual}
                  disabled={manualInput.trim().length === 0}
                >
                  Submit code
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`${buttonClass} shrink-0 ${connected ? 'bg-white/5 text-text-tertiary' : 'bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]'}`}
          onClick={onConnect}
          disabled={connecting || connected}
        >
          {connecting ? 'Opening...' : connected ? 'Connected' : 'Connect provider'}
        </button>
      </div>
    </article>
  );
}

export function OnboardingScreen({
  platform,
  providers,
  requirements,
  client,
}: {
  platform: NodeJS.Platform;
  providers: ProviderState;
  requirements: PermissionRequirement[];
  client: DesktopApi;
}) {
  const [busyPermission, setBusyPermission] = useState<PermissionRequirementId | 'refresh' | null>(null);
  const [busyProvider, setBusyProvider] = useState<ProviderId | 'manual' | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(
    providers.selectedProviderId ?? providers.providers[0]?.id ?? 'openai-sub',
  );
  const [manualInput, setManualInput] = useState('');
  const completeCount = requirements.filter((requirement) =>
    requirement.status === 'granted' || requirement.status === 'not-required'
  ).length;

  const performAction = async (permissionId: PermissionRequirementId) => {
    setBusyPermission(permissionId);
    try {
      await client.performPermissionAction(permissionId);
    } finally {
      setBusyPermission(null);
    }
  };

  const connectProvider = async () => {
    setBusyProvider(selectedProviderId);
    try {
      await client.connectProvider(selectedProviderId);
    } catch {
      // Main process publishes the actionable provider error in AppState.
    } finally {
      setBusyProvider(null);
    }
  };

  const submitManualAuthorization = async () => {
    setBusyProvider('manual');
    try {
      await client.submitProviderAuthorization(selectedProviderId, manualInput);
      setManualInput('');
    } catch {
      // Main process publishes the actionable provider error in AppState.
    } finally {
      setBusyProvider(null);
    }
  };

  const refresh = async () => {
    setBusyPermission('refresh');
    try {
      await client.refreshPermissions();
      await client.refreshProviders();
    } finally {
      setBusyPermission(null);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-10 pt-12 pb-10 max-[980px]:px-6 max-[980px]:pb-6">
      {platform === 'darwin' && (
        <div className="window-drag-region fixed top-0 right-0 left-0 h-10" aria-hidden="true" />
      )}
      <div className="onboarding-backdrop-wash pointer-events-none absolute -inset-[10%]" aria-hidden="true" />

      <section className="relative mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-[920px] items-center">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <header className="max-w-[420px]">
            <span className="mb-4 inline-flex rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-1 text-xs font-bold tracking-[0.16em] text-accent-cyan uppercase">
              Setup sequence
            </span>
            <h1 className="m-0 font-display text-[3rem] leading-[0.95] tracking-[-0.06em] text-text-primary max-[640px]:text-[2.45rem]">
              Pick my brain, then grant the tiny keys.
            </h1>
            <p className="mt-5 mb-0 text-base leading-relaxed text-text-secondary">
              Toph needs a transcription provider first. After that, I will ask for the same system permissions as before. Very orderly. Disturbingly responsible.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3.5 py-2 text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">
                {(providers.ready ? 1 : 0) + completeCount}/{requirements.length + 1}
              </span>
              setup steps complete
            </div>
          </header>

          <div className="panel-surface rounded-[2rem] p-4 shadow-panel">
            <div className="grid gap-3">
              <ProviderCard
                providers={providers.providers}
                selectedProviderId={selectedProviderId}
                busy={busyProvider !== null}
                manualInput={manualInput}
                onSelectProvider={setSelectedProviderId}
                onManualInputChange={setManualInput}
                onConnect={() => void connectProvider()}
                onSubmitManual={() => void submitManualAuthorization()}
              />

              {requirements.length === 0 ? (
                <div className="rounded-3xl border border-white/8 bg-white/4 p-6">
                  <h2 className="m-0 font-display text-xl tracking-[-0.03em]">Inspecting permissions...</h2>
                  <p className="mt-2 mb-0 text-sm text-text-secondary">
                    Rehydrating the macOS permission cache. Classic distributed system: you and System Settings.
                  </p>
                </div>
              ) : (
                requirements.map((requirement) => (
                  <PermissionCard
                    key={requirement.id}
                    requirement={requirement}
                    busy={busyPermission === requirement.id}
                    disabled={!providers.ready}
                    onAction={performAction}
                  />
                ))
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <p className="m-0 text-sm text-text-tertiary">
                Changed something in System Settings or provider land? Make me look again.
              </p>
              <button
                type="button"
                className={`${buttonClass} border-white/8 bg-white/5 text-text-primary hover:bg-white/9`}
                onClick={() => void refresh()}
                disabled={busyPermission !== null || busyProvider !== null}
              >
                {busyPermission === 'refresh' ? 'Checking...' : 'Check again'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
