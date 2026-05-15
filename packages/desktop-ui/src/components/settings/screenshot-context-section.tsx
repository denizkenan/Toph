import {
  formatShortcutChord,
  resolveDefaultScreenshotContextShortcutChord,
  type DesktopApi,
  type ScreenshotContextState,
} from '@toph/desktop-contracts';

import { Button } from '../button';
import { SettingsIcon, SettingsRow, SettingsSection, SettingsSwitch } from './settings-controls';

function formatStatusLabel(screenshots: ScreenshotContextState) {
  if (screenshots.status === 'disabled') return 'Off';
  if (screenshots.status === 'ready') return 'Ready';
  if (screenshots.status === 'capturing') return 'Capturing';
  if (screenshots.status === 'permission-needed') return 'Permission needed';
  if (screenshots.status === 'unavailable') return 'Unavailable';
  return 'Error';
}

export function ScreenshotContextSection({
  screenshots,
  platform,
  disabled,
  busy,
  client,
  onEnabledChange,
}: {
  screenshots: ScreenshotContextState;
  platform: NodeJS.Platform;
  disabled: boolean;
  busy: boolean;
  client: DesktopApi;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const manualShortcutLabel = formatShortcutChord(
    resolveDefaultScreenshotContextShortcutChord(platform),
    platform,
  );

  return (
    <SettingsSection
      eyebrow="Context"
      description={`Optionally add manual active-display screenshots as extra context for polished dictation. Capture while listening with ${manualShortcutLabel}.`}
    >
      <SettingsRow
        label="Screenshot Context"
        description={screenshots.detail}
        icon={
          <SettingsIcon tone="blue">
            <svg
              width="17"
              height="17"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="14" height="10" rx="2" />
              <path d="M8 17h4M10 14v3" />
            </svg>
          </SettingsIcon>
        }
      >
        <span className="text-xs font-semibold text-text-tertiary">
          {formatStatusLabel(screenshots)}
        </span>
        {screenshots.action !== 'none' && (
          <Button
            onClick={() => void client.performPermissionAction('screen')}
            disabled={disabled || busy}
          >
            {screenshots.action === 'request' ? 'Request Access' : 'Open Settings'}
          </Button>
        )}
        <SettingsSwitch
          checked={screenshots.enabled}
          disabled={disabled || busy}
          label="Screenshot Context"
          onCheckedChange={onEnabledChange}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
