import { randomUUID } from 'node:crypto';

import type { TimelineRegionDraft } from './types';

export interface SpeechActivityAnalyzer {
  analyze: (input: { pcm: Buffer; sampleRate: number; durationMs: number }) => Promise<TimelineRegionDraft[]>;
}

export interface EnergySpeechActivityPolicy {
  frameMs: number;
  minSpeechMs: number;
  minSilenceMs: number;
  speechPaddingMs: number;
  minimumEnergyThreshold: number;
  noiseMultiplier: number;
}

const defaultPolicy: EnergySpeechActivityPolicy = {
  frameMs: 30,
  minSpeechMs: 180,
  minSilenceMs: 700,
  speechPaddingMs: 500,
  minimumEnergyThreshold: 0.006,
  noiseMultiplier: 1.8,
};

function createRegionId() {
  return `region_${Date.now()}_${randomUUID()}`;
}

function readSample(pcm: Buffer, sampleIndex: number) {
  return pcm.readInt16LE(sampleIndex * 2) / 32768;
}

function calculateFrameRms(pcm: Buffer, startSample: number, endSample: number) {
  let sum = 0;
  let count = 0;
  for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
    const sample = readSample(pcm, sampleIndex);
    sum += sample * sample;
    count += 1;
  }

  return count === 0 ? 0 : Math.sqrt(sum / count);
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * percentileValue)));
  return sorted[index];
}

function mergeSpeechIntervals(intervals: Array<{ startMs: number; endMs: number }>, maxGapMs = 0) {
  const merged: Array<{ startMs: number; endMs: number }> = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (!previous || interval.startMs - previous.endMs > maxGapMs) {
      merged.push({ ...interval });
      continue;
    }

    previous.endMs = Math.max(previous.endMs, interval.endMs);
  }

  return merged;
}

function regionsFromSpeechIntervals(
  intervals: Array<{ startMs: number; endMs: number }>,
  durationMs: number,
): TimelineRegionDraft[] {
  const regions: TimelineRegionDraft[] = [];
  let cursorMs = 0;

  for (const interval of intervals) {
    if (interval.startMs > cursorMs) {
      regions.push({
        id: createRegionId(),
        sequence: regions.length,
        kind: 'silence',
        startMs: cursorMs,
        endMs: interval.startMs,
        confidence: null,
        createdLive: false,
      });
    }

    regions.push({
      id: createRegionId(),
      sequence: regions.length,
      kind: 'speech',
      startMs: interval.startMs,
      endMs: interval.endMs,
      confidence: null,
      createdLive: false,
    });
    cursorMs = interval.endMs;
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

  return regions;
}

export function createEnergySpeechActivityAnalyzer(
  policy: Partial<EnergySpeechActivityPolicy> = {},
): SpeechActivityAnalyzer {
  const resolvedPolicy = { ...defaultPolicy, ...policy };

  return {
    async analyze({ pcm, sampleRate, durationMs }) {
      const totalSamples = Math.floor(pcm.length / 2);
      const samplesPerFrame = Math.max(1, Math.round((resolvedPolicy.frameMs / 1000) * sampleRate));
      const frames: Array<{ startMs: number; endMs: number; rms: number }> = [];

      for (let startSample = 0; startSample < totalSamples; startSample += samplesPerFrame) {
        const endSample = Math.min(totalSamples, startSample + samplesPerFrame);
        frames.push({
          startMs: Math.round((startSample / sampleRate) * 1000),
          endMs: Math.round((endSample / sampleRate) * 1000),
          rms: calculateFrameRms(pcm, startSample, endSample),
        });
      }

      const noiseFloor = percentile(
        frames.map((frame) => frame.rms),
        0.1,
      );
      const threshold = Math.max(
        resolvedPolicy.minimumEnergyThreshold,
        noiseFloor * resolvedPolicy.noiseMultiplier,
      );
      const rawSpeechIntervals = frames
        .filter((frame) => frame.rms >= threshold)
        .map((frame) => ({ startMs: frame.startMs, endMs: frame.endMs }));

      const mergedIntervals = mergeSpeechIntervals(
        rawSpeechIntervals,
        resolvedPolicy.minSilenceMs,
      ).filter(
        (interval) => interval.endMs - interval.startMs >= resolvedPolicy.minSpeechMs,
      );
      const paddedIntervals = mergedIntervals.map((interval) => ({
        startMs: Math.max(0, interval.startMs - resolvedPolicy.speechPaddingMs),
        endMs: Math.min(durationMs, interval.endMs + resolvedPolicy.speechPaddingMs),
      }));
      const normalizedIntervals = mergeSpeechIntervals(paddedIntervals).filter(
        (interval) => interval.endMs - interval.startMs >= resolvedPolicy.minSpeechMs,
      );
      const regions = regionsFromSpeechIntervals(normalizedIntervals, durationMs);

      return regions.filter((region) => region.endMs > region.startMs);
    },
  };
}
