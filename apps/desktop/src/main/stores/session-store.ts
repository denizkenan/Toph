import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';
import { desc, eq, inArray } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import {
  batchTranscripts,
  batchSourceRanges,
  recordingSessions,
  sessionOutputs,
  timelineRegions,
  transcriptionBatches,
  type BatchTranscript,
  type RecordingSession,
  type SessionOutput,
  type TranscriptionBatch,
} from '../db/schema';
import type { TophDataPaths } from '../paths';
import type { PlannedTranscriptionBatch, TimelineRegionDraft } from '../segmentation/types';

export interface RecordingSessionStore {
  createRecordingSession: () => Promise<RecordingSession>;
  getSession: (sessionId: string) => Promise<RecordingSession | null>;
  markRecorded: (options: {
    sessionId: string;
    endedAt: number;
    durationMs: number;
  }) => Promise<void>;
  markSegmenting: (sessionId: string) => Promise<void>;
  markSegmented: (sessionId: string) => Promise<void>;
  markNoSpeech: (sessionId: string) => Promise<void>;
  // A recorded session with an error is recoverable because the raw WAV exists.
  markRecordedWithProcessingError: (options: { sessionId: string; errorMessage: string }) => Promise<void>;
  markRecordingFailed: (options: { sessionId: string; errorMessage: string; endedAt?: number }) => Promise<void>;
  setProcessingError: (options: { sessionId: string; errorMessage: string }) => Promise<void>;
  clearProcessingError: (sessionId: string) => Promise<void>;
  clearSegmentationData: (sessionId: string) => Promise<void>;
  insertTimelineRegions: (options: {
    sessionId: string;
    regions: TimelineRegionDraft[];
  }) => Promise<void>;
  insertPlannedBatches: (options: {
    sessionId: string;
    batches: PlannedTranscriptionBatch[];
  }) => Promise<void>;
  updateBatchDerivedAudioPaths: (updates: Array<{ batchId: string; derivedAudioPath: string }>) => Promise<void>;
  getTranscriptionBatch: (batchId: string) => Promise<TranscriptionBatch | null>;
  listTranscriptionBatchesForSession: (sessionId: string) => Promise<TranscriptionBatch[]>;
  markBatchTranscribing: (options: { batchId: string; attempts: number; startedAt: number }) => Promise<void>;
  markBatchTranscribed: (options: { batchId: string; transcribedAt: number }) => Promise<void>;
  markBatchFailed: (options: { batchId: string; attempts: number; errorMessage: string }) => Promise<void>;
  insertBatchTranscript: (transcript: BatchTranscript) => Promise<void>;
  listOrderedBatchTranscriptTexts: (sessionId: string) => Promise<string[]>;
  createSelectedSessionOutput: (output: SessionOutput) => Promise<void>;
  listRecentSelectedSessionOutputs: (limit: number) => Promise<SessionOutput[]>;
  pruneRetainedSessions: () => Promise<void>;
  close: () => void;
}

const retainedSessionCount = 10;
const retainableSessionStatuses = ['recorded', 'segmented', 'completed', 'no_speech', 'recording_failed'] as const;

function createSessionId() {
  return `session_${Date.now()}_${randomUUID()}`;
}

function createSessionStoreDatabase(options: {
  databasePath: string;
  migrationsFolder: string;
}): {
  sqlite: Database.Database;
  db: BetterSQLite3Database;
} {
  const sqlite = new Database(options.databasePath);
  sqlite.pragma('journal_mode = WAL');

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: options.migrationsFolder });

  return { sqlite, db };
}

export async function createRecordingSessionStore(options: {
  paths: TophDataPaths;
  migrationsFolder: string;
}): Promise<RecordingSessionStore> {
  await mkdir(dirname(options.paths.databasePath), { recursive: true });
  await mkdir(options.paths.recordingsDirectory, { recursive: true });

  const { sqlite, db } = createSessionStoreDatabase({
    databasePath: options.paths.databasePath,
    migrationsFolder: options.migrationsFolder,
  });

  return {
    async createRecordingSession() {
      const now = Date.now();
      const id = createSessionId();
      const rawAudioPath = join(options.paths.recordingsDirectory, id, 'raw.wav');

      await mkdir(dirname(rawAudioPath), { recursive: true });

      const session = {
        id,
        createdAt: now,
        startedAt: now,
        endedAt: null,
        durationMs: null,
        rawAudioPath,
        status: 'recording' as const,
        selectedOutputId: null,
        errorMessage: null,
      };

      db.insert(recordingSessions).values(session).run();

      return session;
    },

    async getSession(sessionId) {
      return db.select().from(recordingSessions).where(eq(recordingSessions.id, sessionId)).get() ?? null;
    },

    async markRecorded({ sessionId, endedAt, durationMs }) {
      db.update(recordingSessions)
        .set({
          endedAt,
          durationMs,
          status: 'recorded',
          errorMessage: null,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async markSegmenting(sessionId) {
      db.update(recordingSessions)
        .set({
          status: 'segmenting',
          errorMessage: null,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async markSegmented(sessionId) {
      db.update(recordingSessions)
        .set({
          status: 'segmented',
          errorMessage: null,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async markNoSpeech(sessionId) {
      db.update(recordingSessions)
        .set({
          status: 'no_speech',
          errorMessage: null,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async markRecordedWithProcessingError({ sessionId, errorMessage }) {
      db.update(recordingSessions)
        .set({
          status: 'recorded',
          errorMessage,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async markRecordingFailed({ sessionId, errorMessage, endedAt }) {
      db.update(recordingSessions)
        .set({
          endedAt: endedAt ?? Date.now(),
          status: 'recording_failed',
          errorMessage,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async setProcessingError({ sessionId, errorMessage }) {
      db.update(recordingSessions)
        .set({ errorMessage })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async clearProcessingError(sessionId) {
      db.update(recordingSessions)
        .set({ errorMessage: null })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async clearSegmentationData(sessionId) {
      db.transaction(() => {
        const batches = db
          .select({ id: transcriptionBatches.id })
          .from(transcriptionBatches)
          .where(eq(transcriptionBatches.sessionId, sessionId))
          .all();
        const batchIds = batches.map((batch) => batch.id);

        if (batchIds.length > 0) {
          db.delete(batchTranscripts)
            .where(inArray(batchTranscripts.batchId, batchIds))
            .run();
          db.delete(batchSourceRanges)
            .where(inArray(batchSourceRanges.batchId, batchIds))
            .run();
        }

        db.delete(transcriptionBatches)
          .where(eq(transcriptionBatches.sessionId, sessionId))
          .run();
        db.delete(timelineRegions)
          .where(eq(timelineRegions.sessionId, sessionId))
          .run();
        db.delete(sessionOutputs)
          .where(eq(sessionOutputs.sessionId, sessionId))
          .run();
      });
    },

    async insertTimelineRegions({ sessionId, regions }) {
      if (regions.length === 0) {
        return;
      }

      db.insert(timelineRegions)
        .values(
          regions.map((region) => ({
            id: region.id,
            sessionId,
            sequence: region.sequence,
            kind: region.kind,
            startMs: region.startMs,
            endMs: region.endMs,
            confidence: region.confidence,
            createdLive: region.createdLive,
          })),
        )
        .run();
    },

    async insertPlannedBatches({ sessionId, batches }) {
      if (batches.length === 0) {
        return;
      }

      db.transaction(() => {
        const now = Date.now();
        db.insert(transcriptionBatches)
          .values(
            batches.map((batch) => ({
              id: batch.id,
              sessionId,
              sequence: batch.sequence,
              status: 'planned' as const,
              sourceDurationMs: batch.sourceDurationMs,
              derivedAudioDurationMs: batch.derivedAudioDurationMs,
              createdLive: batch.createdLive,
              derivedAudioPath: null,
              createdAt: now,
              transcriptionAttempts: 0,
              transcriptionStartedAt: null,
              transcribedAt: null,
              errorMessage: null,
            })),
          )
          .run();

        const ranges = batches.flatMap((batch) => batch.sourceRanges);
        if (ranges.length === 0) {
          return;
        }

        db.insert(batchSourceRanges)
          .values(
            ranges.map((range) => ({
              id: range.id,
              batchId: range.batchId,
              timelineRegionId: range.timelineRegionId,
              sequence: range.sequence,
              sourceStartMs: range.sourceStartMs,
              sourceEndMs: range.sourceEndMs,
              derivedStartMs: range.derivedStartMs,
              derivedEndMs: range.derivedEndMs,
              reason: range.reason,
            })),
          )
          .run();
      });
    },

    async updateBatchDerivedAudioPaths(updates) {
      db.transaction(() => {
        for (const update of updates) {
          db.update(transcriptionBatches)
            .set({ derivedAudioPath: update.derivedAudioPath })
            .where(eq(transcriptionBatches.id, update.batchId))
            .run();
        }
      });
    },

    async getTranscriptionBatch(batchId) {
      return db.select().from(transcriptionBatches).where(eq(transcriptionBatches.id, batchId)).get() ?? null;
    },

    async listTranscriptionBatchesForSession(sessionId) {
      return db.select().from(transcriptionBatches).where(eq(transcriptionBatches.sessionId, sessionId)).all();
    },

    async markBatchTranscribing({ batchId, attempts, startedAt }) {
      db.update(transcriptionBatches)
        .set({
          status: 'transcribing',
          transcriptionAttempts: attempts,
          transcriptionStartedAt: startedAt,
          errorMessage: null,
        })
        .where(eq(transcriptionBatches.id, batchId))
        .run();
    },

    async markBatchTranscribed({ batchId, transcribedAt }) {
      db.update(transcriptionBatches)
        .set({
          status: 'transcribed',
          transcribedAt,
          errorMessage: null,
        })
        .where(eq(transcriptionBatches.id, batchId))
        .run();
    },

    async markBatchFailed({ batchId, attempts, errorMessage }) {
      db.update(transcriptionBatches)
        .set({
          status: 'failed',
          transcriptionAttempts: attempts,
          errorMessage,
        })
        .where(eq(transcriptionBatches.id, batchId))
        .run();
    },

    async insertBatchTranscript(transcript) {
      db.insert(batchTranscripts).values(transcript).run();
    },

    async listOrderedBatchTranscriptTexts(sessionId) {
      return db
        .select({ text: batchTranscripts.text })
        .from(transcriptionBatches)
        .innerJoin(batchTranscripts, eq(batchTranscripts.batchId, transcriptionBatches.id))
        .where(eq(transcriptionBatches.sessionId, sessionId))
        .orderBy(transcriptionBatches.sequence)
        .all()
        .map((row) => row.text);
    },

    async createSelectedSessionOutput(output) {
      db.transaction(() => {
        db.insert(sessionOutputs).values(output).run();
        db.update(recordingSessions)
          .set({
            status: 'completed',
            selectedOutputId: output.id,
            errorMessage: null,
          })
          .where(eq(recordingSessions.id, output.sessionId))
          .run();
      });
    },

    async listRecentSelectedSessionOutputs(limit) {
      return db
        .select({
          id: sessionOutputs.id,
          sessionId: sessionOutputs.sessionId,
          kind: sessionOutputs.kind,
          text: sessionOutputs.text,
          createdAt: sessionOutputs.createdAt,
        })
        .from(sessionOutputs)
        .innerJoin(recordingSessions, eq(recordingSessions.selectedOutputId, sessionOutputs.id))
        .where(eq(recordingSessions.status, 'completed'))
        .orderBy(desc(sessionOutputs.createdAt))
        .limit(limit)
        .all();
    },

    async pruneRetainedSessions() {
      const terminalSessions = db
        .select()
        .from(recordingSessions)
        .where(inArray(recordingSessions.status, retainableSessionStatuses))
        .orderBy(desc(recordingSessions.endedAt), desc(recordingSessions.createdAt))
        .all();

      const sessionsToPrune = terminalSessions.slice(retainedSessionCount);
      if (sessionsToPrune.length === 0) {
        return;
      }

      await Promise.all(
        sessionsToPrune.map(async (session) => {
          await rm(dirname(session.rawAudioPath), { recursive: true, force: true });
          db.update(recordingSessions)
            .set({ status: 'removed' })
            .where(eq(recordingSessions.id, session.id))
            .run();
        }),
      );
    },

    close() {
      sqlite.close();
    },
  };
}
