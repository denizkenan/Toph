import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type RecordingSessionStatus =
  | 'recording'
  | 'recorded'
  | 'segmenting'
  | 'segmented'
  | 'completed'
  | 'no_speech'
  | 'recording_failed'
  | 'removed';

export type TimelineRegionKind = 'speech' | 'silence';
export type TranscriptionBatchStatus = 'planned' | 'transcribing' | 'transcribed' | 'failed';
export type BatchSourceRangeReason = 'speech' | 'pause_buffer' | 'normal_pause';
export type SessionOutputKind = 'raw_concat';

export const recordingSessions = sqliteTable('recording_sessions', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  durationMs: integer('duration_ms'),
  rawAudioPath: text('raw_audio_path').notNull(),
  status: text('status', {
    enum: ['recording', 'recorded', 'segmenting', 'segmented', 'completed', 'no_speech', 'recording_failed', 'removed'],
  }).notNull(),
  selectedOutputId: text('selected_output_id'),
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
  status: text('status', { enum: ['planned', 'transcribing', 'transcribed', 'failed'] }).notNull(),
  sourceDurationMs: integer('source_duration_ms').notNull(),
  derivedAudioDurationMs: integer('derived_audio_duration_ms').notNull(),
  createdLive: integer('created_live', { mode: 'boolean' }).notNull(),
  derivedAudioPath: text('derived_audio_path'),
  createdAt: integer('created_at').notNull(),
  transcriptionAttempts: integer('transcription_attempts').notNull(),
  transcriptionStartedAt: integer('transcription_started_at'),
  transcribedAt: integer('transcribed_at'),
  errorMessage: text('error_message'),
});

export const batchTranscripts = sqliteTable('batch_transcripts', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  provider: text('provider').notNull(),
  model: text('model'),
  text: text('text').notNull(),
  estimatedBillableDurationMs: integer('estimated_billable_duration_ms').notNull(),
  estimatedCostUsd: integer('estimated_cost_usd'),
  providerRequestId: text('provider_request_id'),
  providerResponseJson: text('provider_response_json'),
  createdAt: integer('created_at').notNull(),
});

export const sessionOutputs = sqliteTable('session_outputs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  kind: text('kind', { enum: ['raw_concat'] }).notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull(),
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
export type BatchTranscript = typeof batchTranscripts.$inferSelect;
export type BatchSourceRange = typeof batchSourceRanges.$inferSelect;
export type SessionOutput = typeof sessionOutputs.$inferSelect;
