import type { ProviderConnection, ProviderId } from '@toph/desktop-contracts';

import { OnboardingButton } from './onboarding-button';
import { StatusText } from './status-text';

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

export function ProviderCard({
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
    <article className="rounded-[1.375rem] border border-white/6 bg-white/2 px-7 py-6 transition-[transform,border-color,background-color] duration-300 ease-out hover:-translate-y-px hover:border-white/10 hover:bg-white/3 max-[640px]:px-5">
      <p className="mt-0 mb-4 text-sm leading-relaxed text-text-secondary">
        Pick the transcription engine that powers Toph.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <select
            className="h-11 w-full rounded-xl border border-white/8 bg-canvas-elevated px-3 text-sm text-text-primary outline-none transition-colors duration-150 hover:bg-white/6 focus:border-accent-blue/40"
            value={selectedProviderId}
            onChange={(event) => onSelectProvider(event.target.value as ProviderId)}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>

        <OnboardingButton
          type="button"
          variant={connected ? 'secondary' : 'primary'}
          onClick={onConnect}
          disabled={connecting || connected}
        >
          {connecting ? 'Opening...' : connected ? 'Connected' : 'Connect provider'}
        </OnboardingButton>
      </div>

      <div className="mt-3">
        <StatusText complete={connected}>{getProviderStatusLabel(selectedProvider)}</StatusText>
      </div>

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
            <OnboardingButton
              type="button"
              variant="secondary"
              onClick={onSubmitManual}
              disabled={manualInput.trim().length === 0}
            >
              Submit code
            </OnboardingButton>
          </div>
        </div>
      )}
    </article>
  );
}
