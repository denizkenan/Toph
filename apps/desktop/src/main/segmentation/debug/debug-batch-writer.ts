import { dirname, join } from 'node:path';

import {
  readPcm16MonoWavRanges,
  slicePcmByTime,
  writePcm16MonoWav,
  type PcmWavFile,
} from '../../audio/wav';
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

export async function writeDebugBatchWavsFromRawFile(options: {
  rawAudioPath: string;
  batches: PlannedTranscriptionBatch[];
}): Promise<Array<{ batchId: string; debugAudioPath: string }>> {
  const results: Array<{ batchId: string; debugAudioPath: string }> = [];
  const sessionRecordingDirectory = dirname(options.rawAudioPath);

  for (const batch of options.batches) {
    const chunks = await readPcm16MonoWavRanges({
      filePath: options.rawAudioPath,
      ranges: batch.sourceRanges.map((range) => ({
        startMs: range.sourceStartMs,
        endMs: range.sourceEndMs,
      })),
    });
    const debugAudioPath = join(
      sessionRecordingDirectory,
      'debug-batches',
      `batch-${String(batch.sequence + 1).padStart(4, '0')}.wav`,
    );

    await writePcm16MonoWav(debugAudioPath, Buffer.concat(chunks));
    results.push({ batchId: batch.id, debugAudioPath });
  }

  return results;
}
