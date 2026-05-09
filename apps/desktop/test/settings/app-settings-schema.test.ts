import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAppSettings, parseAppSettingsFile } from '../../src/main/settings/app-settings-schema.ts';

test('normalizes unknown providers, empty models, and unknown prompts to defaults', () => {
  const settings = normalizeAppSettings(
    parseAppSettingsFile({
      version: 1,
      auth: { providerId: 'unknown-auth' },
      transcription: { providerId: 'unknown-transcription', model: '   ' },
      inference: { providerId: 'unknown-inference', model: '' },
      polish: { enabled: true, promptId: 'missing-prompt' },
    }),
    { promptIds: ['default'] },
  );

  assert.deepEqual(settings, {
    version: 1,
    auth: { providerId: 'openai-sub' },
    transcription: { providerId: 'openai-sub', model: 'chatgpt-backend-transcribe' },
    inference: { providerId: 'openai-sub', model: 'gpt-5.4-mini' },
    polish: { enabled: true, promptId: 'default' },
  });
});

test('rejects invalid settings structure', () => {
  assert.throws(
    () => parseAppSettingsFile({
      version: 1,
      auth: { providerId: 'openai-sub' },
      transcription: { providerId: 'openai-sub', model: 'chatgpt-backend-transcribe' },
      inference: { providerId: 'openai-sub', model: 'gpt-5.4-mini' },
      polish: { enabled: 'yes', promptId: 'default' },
    }),
  );
});
