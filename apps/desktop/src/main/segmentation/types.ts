import type { BatchSourceRangeReason, TimelineRegionKind } from '../db/schema';

export interface TimelineRegionDraft {
  id: string;
  sequence: number;
  kind: TimelineRegionKind;
  startMs: number;
  endMs: number;
  confidence: number | null;
  createdLive: boolean;
}

export interface PlannedBatchSourceRange {
  id: string;
  batchId: string;
  timelineRegionId: string | null;
  sequence: number;
  sourceStartMs: number;
  sourceEndMs: number;
  derivedStartMs: number;
  derivedEndMs: number;
  reason: BatchSourceRangeReason;
}

export interface PlannedTranscriptionBatch {
  id: string;
  sessionId: string;
  sequence: number;
  derivedDurationMs: number;
  createdLive: boolean;
  sourceRanges: PlannedBatchSourceRange[];
}
