import { dirname } from 'node:path';

import { readPcm16MonoWav } from '../audio/wav';
import type { RecordingSessionStore } from '../stores/session-store';
import { createEnergySpeechActivityAnalyzer } from './analyzers/energy-speech-activity-analyzer';
import { createFallbackSpeechActivityAnalyzer } from './analyzers/fallback-speech-activity-analyzer';
import type { SpeechActivityAnalyzer } from './analyzers/speech-activity-analyzer';
import { createSileroSpeechActivityAnalyzer } from './analyzers/silero-speech-activity-analyzer';
import { writeDebugBatchWavs } from './debug/debug-batch-writer';
import { planTranscriptionBatches } from './planning/batch-planner';

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

function createDefaultSpeechActivityAnalyzer() {
  return createFallbackSpeechActivityAnalyzer({
    primary: createSileroSpeechActivityAnalyzer(),
    fallback: createEnergySpeechActivityAnalyzer(),
  });
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
  const analyzer = options.analyzer ?? createDefaultSpeechActivityAnalyzer();

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
        console.info(
          `Toph segmentation pipeline ${analyzer.name} produced ${regions.length} timeline regions for session ${sessionId}.`,
        );

        await options.sessionStore.insertTimelineRegions({ sessionId, regions });

        const batches = planTranscriptionBatches({ sessionId, regions });
        console.info(
          `Toph segmentation planned ${batches.length} transcription batches for session ${sessionId}.`,
        );
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
