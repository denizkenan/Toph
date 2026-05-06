import { dirname } from 'node:path';

import { readPcm16MonoWav } from '../audio/wav';
import type { RecordingSessionStore } from '../stores/session-store';
import { planTranscriptionBatches } from './batch-planner';
import { writeDebugBatchWavs } from './debug-batch-writer';
import { createEnergySpeechActivityAnalyzer, type SpeechActivityAnalyzer } from './energy-speech-analyzer';

export type SegmentationOutcome = 'segmented' | 'no_speech';

export interface SessionSegmentationService {
  segmentRecordedSession: (options: {
    sessionId: string;
    // During Phase 2 this is a verification artifact, so enabled generation is
    // intentionally part of the success/failure contract.
    generateDebugAudio: boolean;
  }) => Promise<SegmentationOutcome>;
}

function describeSegmentationError(error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `Segmentation failed: ${detail}`;
}

export function createSessionSegmentationService(options: {
  sessionStore: Pick<
    RecordingSessionStore,
    | 'getSession'
    | 'markSegmenting'
    | 'markSegmented'
    | 'markNoSpeech'
    | 'markFailed'
    | 'insertTimelineRegions'
    | 'insertPlannedBatches'
    | 'updateBatchDebugAudioPaths'
  >;
  analyzer?: SpeechActivityAnalyzer;
}): SessionSegmentationService {
  const analyzer = options.analyzer ?? createEnergySpeechActivityAnalyzer();

  return {
    async segmentRecordedSession({ sessionId, generateDebugAudio }) {
      try {
        const session = await options.sessionStore.getSession(sessionId);
        if (!session) {
          throw new Error(`Recording session ${sessionId} does not exist.`);
        }
        if (session.status !== 'recorded') {
          throw new Error(`Recording session ${sessionId} is not ready for segmentation.`);
        }

        await options.sessionStore.markSegmenting(sessionId);

        const rawWav = await readPcm16MonoWav(session.rawAudioPath);
        const regions = await analyzer.analyze({
          pcm: rawWav.pcm,
          sampleRate: rawWav.sampleRate,
          durationMs: rawWav.durationMs,
        });

        await options.sessionStore.insertTimelineRegions({ sessionId, regions });

        const batches = planTranscriptionBatches({ sessionId, regions });
        if (batches.length === 0) {
          await options.sessionStore.markNoSpeech(sessionId);
          return 'no_speech';
        }

        await options.sessionStore.insertPlannedBatches({ sessionId, batches });

        if (generateDebugAudio) {
          const debugAudioPaths = await writeDebugBatchWavs({
            sessionRecordingDirectory: dirname(session.rawAudioPath),
            rawWav,
            batches,
          });
          await options.sessionStore.updateBatchDebugAudioPaths(debugAudioPaths);
        }

        await options.sessionStore.markSegmented(sessionId);
        return 'segmented';
      } catch (error) {
        await options.sessionStore.markFailed({
          sessionId,
          errorMessage: describeSegmentationError(error),
        });
        throw error;
      }
    },
  };
}
