import { SettingsSectionHeader, SettingsSelect, StatusBadge, settingsButtonClass, type SettingsSelectItem } from './settings-controls';

export function PolishSection({
  enabled,
  promptId,
  promptItems,
  disabled,
  onEnabledChange,
  onPromptChange,
}: {
  enabled: boolean;
  promptId: string;
  promptItems: SettingsSelectItem[];
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPromptChange: (promptId: string) => void;
}) {
  return (
    <section className="panel-surface mb-5 rounded-3xl p-6">
      <SettingsSectionHeader
        eyebrow="Polish"
        title="Clean up before paste"
        description="Polish uses inference after transcription to preserve your voice while fixing dictation artifacts."
        badge={<StatusBadge active={enabled} activeLabel="Enabled" inactiveLabel="Disabled" />}
      />

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
          className={`${settingsButtonClass} ${enabled ? 'border-white/10 bg-white/6 text-text-primary hover:bg-white/10' : 'bg-linear-to-br from-accent-blue to-accent-violet text-[#11131f]'}`}
          onClick={() => onEnabledChange(!enabled)}
          disabled={disabled}
        >
          {enabled ? 'Disable Polish' : 'Enable Polish'}
        </button>
      </div>

      <div>
        <label className="mb-2 block text-sm text-text-secondary">Prompt</label>
        <SettingsSelect
          items={promptItems}
          value={promptId}
          placeholder="Select prompt"
          disabled={disabled}
          onValueChange={(value) => value !== promptId && onPromptChange(value)}
        />
        <p className="mt-3 mb-0 text-xs text-text-tertiary">
          Active prompt ID: <span className="font-semibold text-text-secondary">{promptId}</span>
        </p>
      </div>
    </section>
  );
}
