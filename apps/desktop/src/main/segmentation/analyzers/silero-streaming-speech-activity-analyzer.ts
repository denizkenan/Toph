import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import type {
  StreamingSpeechActivityAnalyzer,
  StreamingSpeechActivityAnalyzerSession,
} from './streaming-speech-activity-analyzer';

interface FrameProcessorEvent {
  msg: unknown;
  probs?: { isSpeech: number; notSpeech: number };
}

interface FrameProcessorLike {
  process: (frame: Float32Array, handleEvent: (event: FrameProcessorEvent) => void) => Promise<void>;
  endSegment: (handleEvent: (event: FrameProcessorEvent) => void) => unknown;
  resume: () => void;
}

interface StreamingNonRealTimeVadInstance {
  frameProcessor: FrameProcessorLike;
}

interface StreamingNonRealTimeVadConstructor {
  new: (options?: Record<string, unknown>) => Promise<StreamingNonRealTimeVadInstance>;
}

export interface SileroStreamingSpeechActivityPolicy {
  positiveSpeechThreshold: number;
  negativeSpeechThreshold: number;
  redemptionMs: number;
  preSpeechPadMs: number;
  minSpeechMs: number;
}

const defaultPolicy: SileroStreamingSpeechActivityPolicy = {
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
  redemptionMs: 700,
  preSpeechPadMs: 500,
  minSpeechMs: 250,
};

const require = createRequire(import.meta.url);

async function fetchModelFromFile(path: string) {
  const model = await readFile(path);
  return model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength);
}

function resolveLegacyModelPath() {
  const packagePath = require.resolve('@ricky0123/vad-web/package.json');
  return join(dirname(packagePath), 'dist', 'silero_vad_legacy.onnx');
}

function loadVadWeb() {
  return require('@ricky0123/vad-web') as { NonRealTimeVAD: StreamingNonRealTimeVadConstructor };
}

class SileroStreamingSpeechActivitySession implements StreamingSpeechActivityAnalyzerSession {
  constructor(private readonly vad: StreamingNonRealTimeVadInstance) {
    this.vad.frameProcessor.resume();
  }

  async scoreFrame(frame: Float32Array) {
    let probability: number | null = null;

    await this.vad.frameProcessor.process(frame, (event) => {
      if (event.probs) {
        probability = event.probs.isSpeech;
      }
    });

    if (probability === null) {
      throw new Error('Silero VAD did not return a speech probability for the frame.');
    }

    return probability;
  }

  async flush() {
    this.vad.frameProcessor.endSegment(() => {});
  }

  async dispose() {
    await this.flush();
  }
}

export function createSileroStreamingSpeechActivityAnalyzer(
  policy: Partial<SileroStreamingSpeechActivityPolicy> = {},
): StreamingSpeechActivityAnalyzer {
  const resolvedPolicy = { ...defaultPolicy, ...policy };

  const loadVad = () => {
    return loadVadWeb()
      .NonRealTimeVAD.new({
        modelURL: resolveLegacyModelPath(),
        modelFetcher: fetchModelFromFile,
        positiveSpeechThreshold: resolvedPolicy.positiveSpeechThreshold,
        negativeSpeechThreshold: resolvedPolicy.negativeSpeechThreshold,
        redemptionMs: resolvedPolicy.redemptionMs,
        preSpeechPadMs: resolvedPolicy.preSpeechPadMs,
        minSpeechMs: resolvedPolicy.minSpeechMs,
      });
  };

  return {
    name: 'silero-streaming-legacy',
    sampleRate: 16_000,
    frameSizeSamples: 1536,

    async createSession() {
      return new SileroStreamingSpeechActivitySession(await loadVad());
    },
  };
}
