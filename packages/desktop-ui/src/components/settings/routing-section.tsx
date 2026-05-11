import type { ProviderId } from '@toph/desktop-contracts';

import { SettingsSectionHeader, SettingsSelect, SettingsTextInput, type SettingsSelectItem } from './settings-controls';

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
    <section className="panel-surface mb-5 rounded-3xl p-6">
      <SettingsSectionHeader
        eyebrow="Models"
        title="Provider routing"
        description="Choose which provider and model Toph uses for auth, transcription, and inference."
      />

      <div className="grid gap-4">
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Auth provider</label>
          <SettingsSelect
            items={providerItems}
            value={authProviderId}
            placeholder="Select auth provider"
            disabled={disabled}
            onValueChange={onAuthProviderChange}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[640px]:grid-cols-1">
          <div>
            <label className="mb-2 block text-sm text-text-secondary">Transcription provider</label>
            <SettingsSelect
              items={providerItems}
              value={transcriptionProviderId}
              placeholder="Select transcription provider"
              disabled={disabled}
              onValueChange={onTranscriptionProviderChange}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-text-secondary">Transcription model</label>
            <SettingsTextInput value={transcriptionModel} disabled={disabled} onChange={onTranscriptionModelChange} />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[640px]:grid-cols-1">
          <div>
            <label className="mb-2 block text-sm text-text-secondary">Inference provider</label>
            <SettingsSelect
              items={providerItems}
              value={inferenceProviderId}
              placeholder="Select inference provider"
              disabled={disabled}
              onValueChange={onInferenceProviderChange}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-text-secondary">Inference model</label>
            <SettingsTextInput value={inferenceModel} disabled={disabled} onChange={onInferenceModelChange} />
          </div>
        </div>
      </div>
    </section>
  );
}
