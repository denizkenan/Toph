import { dirname, join } from 'node:path';

import {
  readPcm16MonoWavRanges,
  slicePcmByTime,
  writePcm16MonoWav,
  type PcmWavFile,
} from '../audio/wav';
import type { PlannedTranscriptionBatch } from './types';

function getBatchAudioPath(options: { sessionRecordingDirectory: string; sequence: number }) {
  return join(
    options.sessionRecordingDirectory,
    'batches',
    `batch-${String(options.sequence + 1).padStart(4, '0')}.wav`,
  );
}

export async function writeBatchWavs(options: {
  sessionRecordingDirectory: string;
  rawWav: PcmWavFile;
  batches: PlannedTranscriptionBatch[];
}): Promise<Array<{ batchId: string; derivedAudioPath: string }>> {
  const results: Array<{ batchId: string; derivedAudioPath: string }> = [];

  for (const batch of options.batches) {
    const chunks = batch.sourceRanges.map((range) =>
      slicePcmByTime(
        options.rawWav.pcm,
        options.rawWav.sampleRate,
        range.sourceStartMs,
        range.sourceEndMs,
      ),
    );
    const derivedAudioPath = getBatchAudioPath({
      sessionRecordingDirectory: options.sessionRecordingDirectory,
      sequence: batch.sequence,
    });

    await writePcm16MonoWav(derivedAudioPath, Buffer.concat(chunks));
    results.push({ batchId: batch.id, derivedAudioPath });
  }

  return results;
}

export async function writeBatchWavsFromRawFile(options: {
  rawAudioPath: string;
  batches: PlannedTranscriptionBatch[];
}): Promise<Array<{ batchId: string; derivedAudioPath: string }>> {
  const results: Array<{ batchId: string; derivedAudioPath: string }> = [];
  const sessionRecordingDirectory = dirname(options.rawAudioPath);

  for (const batch of options.batches) {
    const chunks = await readPcm16MonoWavRanges({
      filePath: options.rawAudioPath,
      ranges: batch.sourceRanges.map((range) => ({
        startMs: range.sourceStartMs,
        endMs: range.sourceEndMs,
      })),
    });
    const derivedAudioPath = getBatchAudioPath({
      sessionRecordingDirectory,
      sequence: batch.sequence,
    });

    await writePcm16MonoWav(derivedAudioPath, Buffer.concat(chunks));
    results.push({ batchId: batch.id, derivedAudioPath });
  }

  return results;
}
