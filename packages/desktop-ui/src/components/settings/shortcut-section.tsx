import type { ShortcutPresetId } from '@toph/desktop-contracts';

import { SettingsSectionHeader, SettingsSelect, settingsButtonClass, type SettingsSelectItem } from './settings-controls';

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
    <section className="panel-surface mb-5 rounded-3xl p-6">
      <SettingsSectionHeader
        eyebrow="Shortcut"
        title="Change the trigger"
        badge={
          <span className={`inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3.5 py-2 text-sm ${registered ? 'text-accent-green' : 'text-accent-red'}`}>
            <span className={`size-2 rounded-full ${registered ? 'bg-accent-green' : 'bg-accent-red'}`} />
            {registered ? 'Active' : 'Needs attention'}
          </span>
        }
      />

      <div className="mb-4">
        <label className="mb-2 block text-sm text-text-secondary">Shortcut preset</label>
        <SettingsSelect
          items={presetItems}
          value={selectedPresetId}
          placeholder="Select preset"
          onValueChange={onPresetChange}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`${settingsButtonClass} bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]`}
          onClick={onApply}
          disabled={(!dirty && installed) || !installable}
        >
          {dirty || !installed ? 'Apply shortcut' : 'Shortcut installed'}
        </button>
        <span className="text-sm text-text-secondary">
          Backend: {backend}
        </span>
      </div>

      <p className="mt-4 mb-0 text-sm text-text-secondary">{detail}</p>
    </section>
  );
}
