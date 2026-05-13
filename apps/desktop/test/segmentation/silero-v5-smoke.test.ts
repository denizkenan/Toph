import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSileroStreamingSpeechActivityAnalyzer } from '../../src/main/segmentation/analyzers/silero-streaming-speech-activity-analyzer.ts';

describe('Silero v5 streaming analyzer', () => {
  it('loads the packaged v5 model and scores a frame', async () => {
    const analyzer = createSileroStreamingSpeechActivityAnalyzer();
    const session = await analyzer.createSession();

    try {
      assert.equal(analyzer.frameSizeSamples, 512);
      const probability = await session.scoreFrame(new Float32Array(analyzer.frameSizeSamples));
      assert.equal(typeof probability, 'number');
      assert.ok(probability >= 0 && probability <= 1);
    } finally {
      await session.dispose();
    }
  });
});
