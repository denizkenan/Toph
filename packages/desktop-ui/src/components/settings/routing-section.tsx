import type { ProviderId } from '@toph/desktop-contracts';

import { SettingsRow, SettingsSection, SettingsSelect, SettingsTextInput, type SettingsSelectItem } from './settings-controls';

export function RoutingSection({
  providerItems,
  authProviderId,
  transcriptionProviderId,
  transcriptionModel,
  inferenceProviderId,
  inferenceModel,
  disabled,
  onAuthProviderChange,
  onTranscriptionProviderChange,
  onTranscriptionModelChange,
  onInferenceProviderChange,
  onInferenceModelChange,
}: {
  providerItems: SettingsSelectItem<ProviderId>[];
  authProviderId: ProviderId;
  transcriptionProviderId: ProviderId;
  transcriptionModel: string;
  inferenceProviderId: ProviderId;
  inferenceModel: string;
  disabled: boolean;
  onAuthProviderChange: (providerId: ProviderId) => void;
  onTranscriptionProviderChange: (providerId: ProviderId) => void;
  onTranscriptionModelChange: (model: string) => void;
  onInferenceProviderChange: (providerId: ProviderId) => void;
  onInferenceModelChange: (model: string) => void;
}) {
  return (
    <SettingsSection
        eyebrow="Models"
      description="Choose which provider and model Toph uses for auth, transcription, and inference."
    >
      <SettingsRow label="Auth Provider">
          <SettingsSelect
            items={providerItems}
            value={authProviderId}
            placeholder="Select auth provider"
            disabled={disabled}
            onValueChange={onAuthProviderChange}
          />
      </SettingsRow>

      <SettingsRow label="Transcription Provider">
            <SettingsSelect
              items={providerItems}
              value={transcriptionProviderId}
              placeholder="Select transcription provider"
              disabled={disabled}
              onValueChange={onTranscriptionProviderChange}
            />
      </SettingsRow>

      <SettingsRow label="Transcription Model">
        <SettingsTextInput value={transcriptionModel} disabled={disabled} onChange={onTranscriptionModelChange} />
      </SettingsRow>

      <SettingsRow label="Inference Provider">
            <SettingsSelect
              items={providerItems}
              value={inferenceProviderId}
              placeholder="Select inference provider"
              disabled={disabled}
              onValueChange={onInferenceProviderChange}
            />
      </SettingsRow>

      <SettingsRow label="Inference Model">
        <SettingsTextInput value={inferenceModel} disabled={disabled} onChange={onInferenceModelChange} />
      </SettingsRow>
    </SettingsSection>
  );
}
