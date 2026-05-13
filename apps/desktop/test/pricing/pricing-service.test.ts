import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { createPricingService } from '../../src/main/pricing/pricing-service.ts';

async function createServiceWithCatalog(catalog: unknown) {
  const directory = await mkdtemp(join(tmpdir(), 'toph-pricing-test-'));
  const cachePath = join(directory, 'models-dev.json');
  await writeFile(cachePath, `${JSON.stringify(catalog)}\n`);
  return createPricingService({ modelsDevCachePath: cachePath });
}

test('estimates token cost from models.dev pricing without double-counting cached input', async () => {
  const service = await createServiceWithCatalog({
    fetchedAt: Date.now(),
    sourceUrl: 'https://models.dev/api.json',
    providers: {
      openai: {
        models: {
          'gpt-5.4-mini': {
            cost: {
              input: 0.75,
              cache_read: 0.075,
              output: 4.5,
            },
          },
        },
      },
    },
  });

  const estimate = service.estimateCost({
    providerId: 'openai-sub',
    model: 'gpt-5.4-mini',
    usage: {
      kind: 'tokens',
      inputTokens: 1_000_000,
      cachedInputTokens: 250_000,
      outputTokens: 100_000,
    },
  });

  assert.deepEqual(estimate, {
    costUsdMicros: 1_031_250,
    costSource: 'models_dev',
    pricingCatalogProviderId: 'openai',
    pricingCatalogModelId: 'gpt-5.4-mini',
  });
});

test('uses static duration fallback for ChatGPT backend transcription pricing', async () => {
  const service = await createServiceWithCatalog({
    fetchedAt: Date.now(),
    sourceUrl: 'https://models.dev/api.json',
    providers: {},
  });

  const estimate = service.estimateCost({
    providerId: 'openai-sub',
    model: 'chatgpt-backend-transcribe',
    usage: {
      kind: 'audio_duration',
      durationMs: 120_000,
    },
  });

  assert.deepEqual(estimate, {
    costUsdMicros: 6_000,
    costSource: 'static_fallback',
    pricingCatalogProviderId: 'openai',
    pricingCatalogModelId: null,
  });
});
