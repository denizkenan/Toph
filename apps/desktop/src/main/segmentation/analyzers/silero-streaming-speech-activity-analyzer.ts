import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import type {
  StreamingSpeechActivityAnalyzer,
  StreamingSpeechActivityAnalyzerSession,
} from './streaming-speech-activity-analyzer';

interface SileroSpeechProbabilities {
  isSpeech: number;
  notSpeech: number;
}

interface SileroModel {
  process: (frame: Float32Array) => Promise<SileroSpeechProbabilities>;
  reset_state: () => void;
  release: () => Promise<void>;
}

interface SileroModelConstructor {
  new: (ortInstance: unknown, modelFetcher: () => Promise<ArrayBuffer>) => Promise<SileroModel>;
}

export interface SileroStreamingSpeechActivityPolicy {
  model: 'v5';
}

const defaultPolicy: SileroStreamingSpeechActivityPolicy = {
  model: 'v5',
};

const require = createRequire(import.meta.url);
const v5FrameSizeSamples = 512;

async function fetchModelFromFile(path: string) {
  const model = await readFile(path);
  return model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength);
}

function resolveV5ModelPath() {
  const vadPackagePath = require.resolve('@ricky0123/vad-web/package.json');
  const vadPackageDirectory = dirname(vadPackagePath);
  return join(vadPackageDirectory, 'dist', 'silero_vad_v5.onnx');
}

function createVadRequire() {
  return createRequire(require.resolve('@ricky0123/vad-web/package.json'));
}

function loadSileroV5() {
  const vadRequire = createVadRequire();
  return vadRequire('@ricky0123/vad-web/dist/models') as { SileroV5: SileroModelConstructor };
}

function loadOrt() {
  const vadRequire = createVadRequire();
  return vadRequire('onnxruntime-web/wasm') as unknown;
}

class SileroStreamingSpeechActivitySession implements StreamingSpeechActivityAnalyzerSession {
  private readonly model: SileroModel;

  constructor(model: SileroModel) {
    this.model = model;
  }

  async scoreFrame(frame: Float32Array) {
    const probability = await this.model.process(frame);
    return probability.isSpeech;
  }

  async flush() {
    this.model.reset_state();
  }

  async dispose() {
    await this.model.release();
  }
}

export function createSileroStreamingSpeechActivityAnalyzer(
  policy: Partial<SileroStreamingSpeechActivityPolicy> = {},
): StreamingSpeechActivityAnalyzer {
  const resolvedPolicy = { ...defaultPolicy, ...policy };

  const loadModel = async () => {
    if (resolvedPolicy.model !== 'v5') {
      throw new Error(`Unsupported Silero model ${resolvedPolicy.model}.`);
    }

    const { SileroV5 } = loadSileroV5();
    return SileroV5.new(loadOrt(), () => fetchModelFromFile(resolveV5ModelPath()));
  };

  return {
    name: 'silero-streaming-v5',
    sampleRate: 16_000,
    frameSizeSamples: v5FrameSizeSamples,

    async createSession() {
      return new SileroStreamingSpeechActivitySession(await loadModel());
    },
  };
}
