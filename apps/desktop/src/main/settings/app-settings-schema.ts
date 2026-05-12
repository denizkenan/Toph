import {
  DEFAULT_APP_SETTINGS,
  PROVIDER_IDS,
  resolveDefaultShortcutChord,
  validateShortcutChord,
  type AppSettings,
  type ProviderId,
} from '@toph/desktop-contracts';
import { z } from 'zod';

const shortcutModifierSchema = z.enum(['command', 'control', 'option', 'alt', 'shift']);
const shortcutChordSchema = z.object({
  modifiers: z.array(shortcutModifierSchema),
  key: z.string(),
});

const appSettingsFileSchema = z.object({
  version: z.literal(1),
  shortcut: z.object({
    chord: shortcutChordSchema,
  }).optional(),
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
    rulePresetId: z.string().nullable().optional(),
    promptId: z.string().optional(),
  }),
});

type AppSettingsFile = z.infer<typeof appSettingsFileSchema>;

export const defaultAppSettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  shortcut: {
    chord: resolveDefaultShortcutChord(process.platform),
  },
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

export function normalizeAppSettings(value: AppSettingsFile, options: { rulePresetIds: string[] }): AppSettings {
  const selectedRulePresetId = value.polish.rulePresetId ?? value.polish.promptId ?? null;
  const rulePresetId = selectedRulePresetId && options.rulePresetIds.includes(selectedRulePresetId)
    ? selectedRulePresetId
    : null;
  const shortcutValidation = value.shortcut
    ? validateShortcutChord(value.shortcut.chord)
    : null;

  return {
    version: 1,
    shortcut: {
      chord: shortcutValidation?.valid ? shortcutValidation.chord : defaultAppSettings.shortcut.chord,
    },
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
      rulePresetId,
    },
  };
}
