import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import type { TimelineRegionDraft } from '../types';
import type { SpeechActivityAnalyzer } from './speech-activity-analyzer';

interface NonRealTimeVadSpeechData {
  start: number;
  end: number;
}

interface NonRealTimeVadInstance {
  run: (inputAudio: Float32Array, sampleRate: number) => AsyncGenerator<NonRealTimeVadSpeechData>;
}

interface NonRealTimeVadConstructor {
  new: (options?: Record<string, unknown>) => Promise<NonRealTimeVadInstance>;
}

export interface SileroSpeechActivityPolicy {
  positiveSpeechThreshold: number;
  negativeSpeechThreshold: number;
  redemptionMs: number;
  preSpeechPadMs: number;
  minSpeechMs: number;
  mergeSpeechGapMs: number;
}

const defaultPolicy: SileroSpeechActivityPolicy = {
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
  redemptionMs: 700,
  preSpeechPadMs: 500,
  minSpeechMs: 250,
  mergeSpeechGapMs: 250,
};

const require = createRequire(import.meta.url);

function createRegionId() {
  return `region_${Date.now()}_${randomUUID()}`;
}

function pcm16ToFloat32(pcm: Buffer) {
  const samples = new Float32Array(Math.floor(pcm.length / 2));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = pcm.readInt16LE(index * 2) / 32768;
  }

  return samples;
}

function mergeSpeechSegments(
  segments: Array<{ startMs: number; endMs: number }>,
  maxGapMs: number,
) {
  const merged: Array<{ startMs: number; endMs: number }> = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (!previous || segment.startMs - previous.endMs > maxGapMs) {
      merged.push({ ...segment });
      continue;
    }

    previous.endMs = Math.max(previous.endMs, segment.endMs);
  }

  return merged;
}

function regionsFromSpeechSegments(
  segments: Array<{ startMs: number; endMs: number }>,
  durationMs: number,
): TimelineRegionDraft[] {
  const regions: TimelineRegionDraft[] = [];
  let cursorMs = 0;

  for (const segment of segments) {
    if (segment.startMs > cursorMs) {
      regions.push({
        id: createRegionId(),
        sequence: regions.length,
        kind: 'silence',
        startMs: cursorMs,
        endMs: segment.startMs,
        confidence: null,
        createdLive: false,
      });
    }

    regions.push({
      id: createRegionId(),
      sequence: regions.length,
      kind: 'speech',
      startMs: segment.startMs,
      endMs: segment.endMs,
      confidence: null,
      createdLive: false,
    });
    cursorMs = segment.endMs;
  }

  if (cursorMs < durationMs) {
    regions.push({
      id: createRegionId(),
      sequence: regions.length,
      kind: 'silence',
      startMs: cursorMs,
      endMs: durationMs,
      confidence: null,
      createdLive: false,
    });
  }

  if (regions.length === 0) {
    regions.push({
      id: createRegionId(),
      sequence: 0,
      kind: 'silence',
      startMs: 0,
      endMs: durationMs,
      confidence: null,
      createdLive: false,
    });
  }

  return regions.filter((region) => region.endMs > region.startMs);
}

async function fetchModelFromFile(path: string) {
  const model = await readFile(path);
  return model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength);
}

function resolveLegacyModelPath() {
  const packagePath = require.resolve('@ricky0123/vad-web/package.json');
  return join(dirname(packagePath), 'dist', 'silero_vad_legacy.onnx');
}

function loadNonRealTimeVad() {
  return require('@ricky0123/vad-web') as { NonRealTimeVAD: NonRealTimeVadConstructor };
}

export function createSileroSpeechActivityAnalyzer(
  policy: Partial<SileroSpeechActivityPolicy> = {},
): SpeechActivityAnalyzer {
  const resolvedPolicy = { ...defaultPolicy, ...policy };
  let vadPromise: Promise<NonRealTimeVadInstance> | null = null;

  const loadVad = () => {
    vadPromise ??= loadNonRealTimeVad()
      .NonRealTimeVAD.new({
        modelURL: resolveLegacyModelPath(),
        modelFetcher: fetchModelFromFile,
        positiveSpeechThreshold: resolvedPolicy.positiveSpeechThreshold,
        negativeSpeechThreshold: resolvedPolicy.negativeSpeechThreshold,
        redemptionMs: resolvedPolicy.redemptionMs,
        preSpeechPadMs: resolvedPolicy.preSpeechPadMs,
        minSpeechMs: resolvedPolicy.minSpeechMs,
      })
      .catch((error: unknown) => {
        vadPromise = null;
        throw error;
      });

    return vadPromise;
  };

  return {
    name: 'silero',

    async analyze({ pcm, sampleRate, durationMs }) {
      const vad = await loadVad();
      const speechSegments: Array<{ startMs: number; endMs: number }> = [];

      for await (const segment of vad.run(pcm16ToFloat32(pcm), sampleRate)) {
        speechSegments.push({
          startMs: Math.max(0, Math.round(segment.start)),
          endMs: Math.min(durationMs, Math.round(segment.end)),
        });
      }

      return regionsFromSpeechSegments(
        mergeSpeechSegments(speechSegments, resolvedPolicy.mergeSpeechGapMs),
        durationMs,
      );
    },
  };
}
