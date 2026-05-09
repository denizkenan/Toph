import { strict as assert } from 'node:assert';
import test from 'node:test';

import { TransientInferenceProviderError, type InferenceProvider } from '../../src/main/inference/inference-provider.ts';
import { createPolishService } from '../../src/main/polish/polish-service.ts';

const prompt = {
  id: 'default',
  title: 'Default',
  body: 'Polish the transcript.',
  bodyHash: 'prompt-hash',
  isBuiltin: true,
  createdAt: 1,
  updatedAt: 1,
};

function createService(provider: InferenceProvider, options: { promptAvailable?: boolean } = {}) {
  return createPolishService({
    inference: provider,
    settingsStore: {
      getSettings() {
        return {
          version: 1,
          auth: { providerId: 'openai-sub' },
          transcription: { providerId: 'openai-sub', model: 'chatgpt-backend-transcribe' },
          inference: { providerId: 'openai-sub', model: 'gpt-5.4-mini' },
          polish: { enabled: true, promptId: 'default' },
        };
      },
    },
    sessionStore: {
      async getPolishPrompt() {
        return options.promptAvailable === false ? null : prompt;
      },
    },
    outputs: {
      async createPolishedOutput(input) {
        return {
          id: 'polished-output',
          text: input.text,
          createdAt: 2,
          promptId: input.promptId,
          promptHash: input.promptHash,
        };
      },
    },
  });
}

test('retries transient empty inference output failures', async () => {
  let attempts = 0;
  const service = createService({
    id: 'test',
    async inferText() {
      attempts += 1;
      if (attempts < 3) {
        throw new TransientInferenceProviderError('empty output');
      }

      return {
        text: 'Polished text.',
        provider: 'test',
        model: 'test-model',
        providerRequestId: null,
        providerResponseJson: null,
      };
    },
  });

  const output = await service.polishOutput({
    sessionId: 'session-1',
    rawOutput: { id: 'raw-output', text: 'raw text' },
  });

  assert.equal(attempts, 3);
  assert.equal(output.text, 'Polished text.');
  assert.equal(output.promptId, 'default');
  assert.equal(output.promptHash, 'prompt-hash');
});

test('does not retry permanent inference failures', async () => {
  let attempts = 0;
  const service = createService({
    id: 'test',
    async inferText() {
      attempts += 1;
      throw new Error('permanent failure');
    },
  });

  await assert.rejects(
    () => service.polishOutput({ sessionId: 'session-1', rawOutput: { id: 'raw-output', text: 'raw text' } }),
    /permanent failure/,
  );
  assert.equal(attempts, 1);
});

test('fails when the active prompt is unavailable', async () => {
  const service = createService(
    {
      id: 'test',
      async inferText() {
        throw new Error('should not run');
      },
    },
    { promptAvailable: false },
  );

  await assert.rejects(
    () => service.polishOutput({ sessionId: 'session-1', rawOutput: { id: 'raw-output', text: 'raw text' } }),
    /not available/,
  );
});
