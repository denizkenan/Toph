import type { TimelineRegionDraft } from '../types';

export interface SpeechActivityAnalyzer {
  name: string;
  analyze: (input: {
    pcm: Buffer;
    sampleRate: number;
    durationMs: number;
  }) => Promise<TimelineRegionDraft[]>;
}
