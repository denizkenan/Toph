import { join } from 'node:path';

import { slicePcmByTime, writePcm16MonoWav, type PcmWavFile } from '../../audio/wav';
import type { PlannedTranscriptionBatch } from '../types';

export async function writeDebugBatchWavs(options: {
  sessionRecordingDirectory: string;
  rawWav: PcmWavFile;
  batches: PlannedTranscriptionBatch[];
}): Promise<Array<{ batchId: string; debugAudioPath: string }>> {
  const results: Array<{ batchId: string; debugAudioPath: string }> = [];

  for (const batch of options.batches) {
    const chunks = batch.sourceRanges.map((range) =>
      slicePcmByTime(
        options.rawWav.pcm,
        options.rawWav.sampleRate,
        range.sourceStartMs,
        range.sourceEndMs,
      ),
    );
    const debugAudioPath = join(
      options.sessionRecordingDirectory,
      'debug-batches',
      `batch-${String(batch.sequence + 1).padStart(4, '0')}.wav`,
    );

    await writePcm16MonoWav(debugAudioPath, Buffer.concat(chunks));
    results.push({ batchId: batch.id, debugAudioPath });
  }

  return results;
}
