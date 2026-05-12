import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDefaultShortcutChord } from '@toph/desktop-contracts';

import { normalizeAppSettings, parseAppSettingsFile } from '../../src/main/settings/app-settings-schema.ts';

test('normalizes unknown providers, empty models, and unknown prompts to defaults', () => {
  const settings = normalizeAppSettings(
    parseAppSettingsFile({
      version: 1,
      shortcut: { chord: { modifiers: ['control', 'alt'], key: 'Space' } },
      auth: { providerId: 'unknown-auth' },
      transcription: { providerId: 'unknown-transcription', model: '   ' },
      inference: { providerId: 'unknown-inference', model: '' },
      polish: { enabled: true, promptId: 'missing-prompt' },
    }),
    { promptIds: ['default'] },
  );

  assert.deepEqual(settings, {
    version: 1,
    shortcut: { chord: { modifiers: ['control', 'alt'], key: 'Space' } },
    auth: { providerId: 'openai-sub' },
    transcription: { providerId: 'openai-sub', model: 'chatgpt-backend-transcribe' },
    inference: { providerId: 'openai-sub', model: 'gpt-5.4-mini' },
    polish: { enabled: true, promptId: 'default' },
  });
});

test('normalizes existing v1 settings without a shortcut to the platform default', () => {
  const settings = normalizeAppSettings(
    parseAppSettingsFile({
      version: 1,
      auth: { providerId: 'openai-sub' },
      transcription: { providerId: 'openai-sub', model: 'chatgpt-backend-transcribe' },
      inference: { providerId: 'openai-sub', model: 'gpt-5.4-mini' },
      polish: { enabled: false, promptId: 'default' },
    }),
    { promptIds: ['default'] },
  );

  assert.deepEqual(settings.shortcut.chord, resolveDefaultShortcutChord(process.platform));
  assert.equal(settings.polish.enabled, false);
});

test('rejects invalid settings structure', () => {
  assert.throws(
    () => parseAppSettingsFile({
      version: 1,
      shortcut: { chord: { modifiers: ['control', 'alt'], key: 'Space' } },
      auth: { providerId: 'openai-sub' },
      transcription: { providerId: 'openai-sub', model: 'chatgpt-backend-transcribe' },
      inference: { providerId: 'openai-sub', model: 'gpt-5.4-mini' },
      polish: { enabled: 'yes', promptId: 'default' },
    }),
  );
});
