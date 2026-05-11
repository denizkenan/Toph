import type { ShortcutPresetId } from '@toph/desktop-contracts';

import { Button } from '../button';
import { SettingsRow, SettingsSection, SettingsSelect, StatusBadge, type SettingsSelectItem } from './settings-controls';

export function ShortcutSection({
  presetItems,
  selectedPresetId,
  registered,
  backend,
  detail,
  dirty,
  installed,
  installable,
  onPresetChange,
  onApply,
}: {
  presetItems: SettingsSelectItem<ShortcutPresetId>[];
  selectedPresetId: ShortcutPresetId;
  registered: boolean;
  backend: string;
  detail: string;
  dirty: boolean;
  installed: boolean;
  installable: boolean;
  onPresetChange: (presetId: ShortcutPresetId) => void;
  onApply: () => void;
}) {
  return (
    <SettingsSection
        eyebrow="Shortcut"
      description="Configure the keyboard shortcut that triggers dictation."
      footer={detail}
    >
      <SettingsRow label="Registration">
        <StatusBadge active={registered} activeLabel="Active" inactiveLabel="Needs attention" inactiveTone="red" />
      </SettingsRow>

      <SettingsRow label="Shortcut Preset">
        <SettingsSelect
          items={presetItems}
          value={selectedPresetId}
          placeholder="Select preset"
          onValueChange={onPresetChange}
        />
      </SettingsRow>

      <SettingsRow label="Backend">
        <span className="text-sm font-semibold text-text-secondary">{backend}</span>
      </SettingsRow>

      <div className="flex justify-end px-4 py-3">
        <Button variant="primary" onClick={onApply} disabled={(!dirty && installed) || !installable}>
          {dirty || !installed ? 'Apply shortcut' : 'Shortcut installed'}
        </Button>
      </div>
    </SettingsSection>
  );
}
