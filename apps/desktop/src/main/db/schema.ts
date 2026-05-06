import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const recordingSessions = sqliteTable('recording_sessions', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  durationMs: integer('duration_ms'),
  rawAudioPath: text('raw_audio_path').notNull(),
  status: text('status', { enum: ['recording', 'recorded', 'failed', 'removed'] }).notNull(),
  errorMessage: text('error_message'),
});

export type RecordingSessionStatus = 'recording' | 'recorded' | 'failed' | 'removed';
export type RecordingSession = typeof recordingSessions.$inferSelect;
