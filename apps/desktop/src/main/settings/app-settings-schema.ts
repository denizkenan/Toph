import {
  DEFAULT_APP_SETTINGS,
  PROVIDER_IDS,
  type AppSettings,
  type ProviderId,
} from '@toph/desktop-contracts';
import { z } from 'zod';

const appSettingsFileSchema = z.object({
  version: z.literal(1),
  auth: z.object({
    providerId: z.string(),
  }),
  transcription: z.object({
    providerId: z.string(),
    model: z.string(),
  }),
  inference: z.object({
    providerId: z.string(),
    model: z.string(),
  }),
  polish: z.object({
    enabled: z.boolean(),
    promptId: z.string(),
  }),
});

type AppSettingsFile = z.infer<typeof appSettingsFileSchema>;

export const defaultAppSettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
};

function isKnownProviderId(providerId: string): providerId is ProviderId {
  return PROVIDER_IDS.includes(providerId as ProviderId);
}

function normalizeProviderId(providerId: string, fallback: ProviderId) {
  return isKnownProviderId(providerId) ? providerId : fallback;
}

function normalizeModel(model: string, fallback: string) {
  const trimmed = model.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function parseAppSettingsFile(value: unknown): AppSettingsFile {
  return appSettingsFileSchema.parse(value);
}

export function normalizeAppSettings(value: AppSettingsFile, options: { promptIds: string[] }): AppSettings {
  const promptId = options.promptIds.includes(value.polish.promptId)
    ? value.polish.promptId
    : defaultAppSettings.polish.promptId;

  return {
    version: 1,
    auth: {
      providerId: normalizeProviderId(value.auth.providerId, defaultAppSettings.auth.providerId),
    },
    transcription: {
      providerId: normalizeProviderId(value.transcription.providerId, defaultAppSettings.transcription.providerId),
      model: normalizeModel(value.transcription.model, defaultAppSettings.transcription.model),
    },
    inference: {
      providerId: normalizeProviderId(value.inference.providerId, defaultAppSettings.inference.providerId),
      model: normalizeModel(value.inference.model, defaultAppSettings.inference.model),
    },
    polish: {
      enabled: value.polish.enabled,
      promptId,
    },
  };
}
