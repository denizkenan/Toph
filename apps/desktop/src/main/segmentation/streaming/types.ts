import type { PlannedTranscriptionBatch, TimelineRegionDraft } from '../types';

export interface SpeechProbabilityFrame {
  startMs: number;
  endMs: number;
  speechProbability: number;
}

export interface StreamingSpeechActivityAnalyzer {
  name: string;
  sampleRate: number;
  frameSizeSamples: number;
  createSession: () => Promise<StreamingSpeechActivityAnalyzerSession>;
}

export interface StreamingSpeechActivityAnalyzerSession {
  scoreFrame: (frame: Float32Array) => Promise<number>;
  flush: () => Promise<void>;
  dispose: () => Promise<void>;
}

export interface SegmentationPipelineOutcome {
  regions: TimelineRegionDraft[];
  batches: PlannedTranscriptionBatch[];
  result: 'segmented' | 'no_speech';
}
