import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type RecordingSessionStatus =
  | 'recording'
  | 'recorded'
  | 'segmenting'
  | 'segmented'
  | 'no_speech'
  | 'failed'
  | 'removed';

export type TimelineRegionKind = 'speech' | 'silence';
export type TranscriptionBatchStatus = 'planned';
export type BatchSourceRangeReason = 'speech' | 'pause_buffer' | 'normal_pause';

export const recordingSessions = sqliteTable('recording_sessions', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  durationMs: integer('duration_ms'),
  rawAudioPath: text('raw_audio_path').notNull(),
  status: text('status', {
    enum: ['recording', 'recorded', 'segmenting', 'segmented', 'no_speech', 'failed', 'removed'],
  }).notNull(),
  errorMessage: text('error_message'),
});

export const timelineRegions = sqliteTable('timeline_regions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  sequence: integer('sequence').notNull(),
  kind: text('kind', { enum: ['speech', 'silence'] }).notNull(),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
  confidence: integer('confidence'),
  createdLive: integer('created_live', { mode: 'boolean' }).notNull(),
});

export const transcriptionBatches = sqliteTable('transcription_batches', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  sequence: integer('sequence').notNull(),
  status: text('status', { enum: ['planned'] }).notNull(),
  derivedDurationMs: integer('derived_duration_ms').notNull(),
  createdLive: integer('created_live', { mode: 'boolean' }).notNull(),
  debugAudioPath: text('debug_audio_path'),
  createdAt: integer('created_at').notNull(),
  queuedAt: integer('queued_at'),
  transcribedAt: integer('transcribed_at'),
  errorMessage: text('error_message'),
});

export const batchSourceRanges = sqliteTable('batch_source_ranges', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  timelineRegionId: text('timeline_region_id'),
  sequence: integer('sequence').notNull(),
  sourceStartMs: integer('source_start_ms').notNull(),
  sourceEndMs: integer('source_end_ms').notNull(),
  derivedStartMs: integer('derived_start_ms').notNull(),
  derivedEndMs: integer('derived_end_ms').notNull(),
  reason: text('reason', { enum: ['speech', 'pause_buffer', 'normal_pause'] }).notNull(),
});

export type RecordingSession = typeof recordingSessions.$inferSelect;
export type TimelineRegion = typeof timelineRegions.$inferSelect;
export type TranscriptionBatch = typeof transcriptionBatches.$inferSelect;
export type BatchSourceRange = typeof batchSourceRanges.$inferSelect;
