import { SettingsIcon, SettingsRow, SettingsSection, SettingsSelect, SettingsSwitch, type SettingsSelectItem } from './settings-controls';

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
    <SettingsSection
        eyebrow="Polish"
      description="Polish uses inference after transcription to preserve your voice while fixing dictation artifacts."
      footer={(
        <>
          Active prompt ID: <span className="font-semibold text-text-secondary">{promptId}</span>
        </>
      )}
    >
      <SettingsRow
        label="Polish Dictation"
        description="When disabled, Toph pastes the raw assembled transcript."
        icon={(
          <SettingsIcon tone="green">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h12M10 4v12" />
              <circle cx="10" cy="10" r="7" />
            </svg>
          </SettingsIcon>
        )}
      >
        <SettingsSwitch checked={enabled} disabled={disabled} label="Polish Dictation" onCheckedChange={onEnabledChange} />
      </SettingsRow>

      <SettingsRow label="Prompt">
        <SettingsSelect
          items={promptItems}
          value={promptId}
          placeholder="Select prompt"
          disabled={disabled}
          onValueChange={(value) => value !== promptId && onPromptChange(value)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
