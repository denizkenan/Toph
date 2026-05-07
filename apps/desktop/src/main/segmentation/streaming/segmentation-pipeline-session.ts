import type { RecordingSessionStore } from '../../stores/session-store';
import { writeDebugBatchWavsFromRawFile } from '../debug/debug-batch-writer';
import type { PlannedTranscriptionBatch, TimelineRegionDraft } from '../types';
import { PcmFrameBuffer } from './pcm-frame-buffer';
import { LiveBatchPlanner } from './live-batch-planner';
import { TimelineAssembler } from './timeline-assembler';
import type { SegmentationPipelineOutcome, StreamingSpeechActivityAnalyzer } from './types';

export interface SegmentationPipelineSession {
  processPcmChunk: (chunk: Buffer) => Promise<void>;
  flush: () => Promise<SegmentationPipelineOutcome>;
  dispose: () => Promise<void>;
}

export async function createSegmentationPipelineSession(options: {
  sessionId: string;
  rawAudioPath: string;
  createdLive: boolean;
  generateDebugAudio: boolean;
  analyzer: StreamingSpeechActivityAnalyzer;
  sessionStore: Pick<
    RecordingSessionStore,
    'insertTimelineRegions' | 'insertPlannedBatches' | 'updateBatchDebugAudioPaths'
  >;
}): Promise<SegmentationPipelineSession> {
  const analyzerSession = await options.analyzer.createSession();
  const frameBuffer = new PcmFrameBuffer({
    sampleRate: options.analyzer.sampleRate,
    frameSizeSamples: options.analyzer.frameSizeSamples,
    analyzerSession,
  });
  const timelineAssembler = new TimelineAssembler({ createdLive: options.createdLive });
  const batchPlanner = new LiveBatchPlanner({
    sessionId: options.sessionId,
    createdLive: options.createdLive,
  });
  const persistedRegions: TimelineRegionDraft[] = [];
  const persistedBatches: PlannedTranscriptionBatch[] = [];

  const writeDebugAudioForBatches = async (batches: PlannedTranscriptionBatch[]) => {
    if (!options.generateDebugAudio || batches.length === 0) {
      return;
    }

    const debugAudioPaths = await writeDebugBatchWavsFromRawFile({
      rawAudioPath: options.rawAudioPath,
      batches,
    });
    await options.sessionStore.updateBatchDebugAudioPaths(debugAudioPaths);
  };

  const persistPipelineOutput = async (regions: TimelineRegionDraft[]) => {
    if (regions.length === 0) {
      return;
    }

    await options.sessionStore.insertTimelineRegions({ sessionId: options.sessionId, regions });
    persistedRegions.push(...regions);

    const batches = batchPlanner.appendRegions(regions);
    if (batches.length === 0) {
      return;
    }

    await options.sessionStore.insertPlannedBatches({ sessionId: options.sessionId, batches });
    persistedBatches.push(...batches);
    await writeDebugAudioForBatches(batches);
  };

  return {
    async processPcmChunk(chunk) {
      const probabilityFrames = await frameBuffer.processChunk(chunk);
      await persistPipelineOutput(timelineAssembler.processFrames(probabilityFrames));
    },

    async flush() {
      const probabilityFrames = await frameBuffer.flush();
      await persistPipelineOutput(timelineAssembler.processFrames(probabilityFrames));
      await persistPipelineOutput(timelineAssembler.flush());

      const finalBatches = batchPlanner.flush();
      if (finalBatches.length > 0) {
        await options.sessionStore.insertPlannedBatches({
          sessionId: options.sessionId,
          batches: finalBatches,
        });
        persistedBatches.push(...finalBatches);
        await writeDebugAudioForBatches(finalBatches);
      }

      return {
        regions: persistedRegions,
        batches: persistedBatches,
        result: persistedBatches.length === 0 ? 'no_speech' : 'segmented',
      };
    },

    async dispose() {
      await analyzerSession.dispose();
    },
  };
}
