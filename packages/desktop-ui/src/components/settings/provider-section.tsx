import type { ProviderConnection } from '@toph/desktop-contracts';

import { SettingsSectionHeader, StatusBadge, settingsButtonClass } from './settings-controls';

export function ProviderSection({
  provider,
  busy,
  onConnect,
  onRemove,
}: {
  provider: ProviderConnection | undefined;
  busy: boolean;
  onConnect: () => void;
  onRemove: () => void;
}) {
  const connected = provider?.status === 'connected';

  return (
    <section className="panel-surface mb-5 rounded-3xl p-6">
      <SettingsSectionHeader
        eyebrow="Providers"
        title="Transcription engine"
        badge={provider && <StatusBadge active={connected} activeLabel="Connected" inactiveLabel="Needs setup" inactiveTone="text-accent-amber" />}
      />

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
                className={`${settingsButtonClass} bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]`}
                onClick={onConnect}
                disabled={busy || provider.status === 'connecting'}
              >
                {connected ? 'Reconnect' : 'Connect'}
              </button>
              <button
                type="button"
                className={`${settingsButtonClass} border-accent-red/20 bg-accent-red/10 text-accent-red hover:bg-accent-red/18`}
                onClick={onRemove}
                disabled={busy || !connected}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
