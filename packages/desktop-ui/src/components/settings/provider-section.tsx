import type { ProviderConnection } from '@toph/desktop-contracts';

import { Button } from '../button';
import { SettingsIcon, SettingsRow, SettingsSection, StatusBadge } from './settings-controls';

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
    <SettingsSection
        eyebrow="Providers"
      description="Connect your transcription service to enable dictation."
    >
      {!provider && <SettingsRow label="No provider available" description="Toph could not find a configured transcription provider." />}

      {provider && (
        <>
          <SettingsRow
            label={provider.label}
            description={(
              <>
                {provider.description}
                {provider.accountId && (
                  <span className="block text-text-tertiary">
                    Account: <span className="font-semibold text-text-secondary">{provider.accountId}</span>
                  </span>
                )}
              </>
            )}
            icon={(
              <SettingsIcon tone="blue">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="7" r="4" />
                  <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                </svg>
              </SettingsIcon>
            )}
          >
            <StatusBadge active={connected} activeLabel="Connected" inactiveLabel="Needs setup" inactiveTone="amber" />
          </SettingsRow>

          {provider.error && (
            <SettingsRow label="Provider error" description={provider.error} tone="danger" />
          )}

          <div className="flex justify-end gap-2 px-4 py-3">
            <Button variant="primary" onClick={onConnect} disabled={busy || provider.status === 'connecting'}>
              {connected ? 'Reconnect' : 'Connect'}
            </Button>
            <Button variant="danger" onClick={onRemove} disabled={busy || !connected}>
              Remove
            </Button>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
