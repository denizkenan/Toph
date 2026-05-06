import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';
import { desc, eq, inArray } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import {
  batchSourceRanges,
  recordingSessions,
  timelineRegions,
  transcriptionBatches,
  type RecordingSession,
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
  markFailed: (options: { sessionId: string; errorMessage: string; endedAt?: number }) => Promise<void>;
  insertTimelineRegions: (options: {
    sessionId: string;
    regions: TimelineRegionDraft[];
  }) => Promise<void>;
  insertPlannedBatches: (options: {
    sessionId: string;
    batches: PlannedTranscriptionBatch[];
  }) => Promise<void>;
  updateBatchDebugAudioPaths: (updates: Array<{ batchId: string; debugAudioPath: string }>) => Promise<void>;
  pruneRetainedSessions: () => Promise<void>;
  close: () => void;
}

const retainedSessionCount = 10;
const retainableSessionStatuses = ['recorded', 'segmented', 'no_speech', 'failed'] as const;

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

    async markFailed({ sessionId, errorMessage, endedAt }) {
      db.update(recordingSessions)
        .set({
          endedAt: endedAt ?? Date.now(),
          status: 'failed',
          errorMessage,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
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
              derivedDurationMs: batch.derivedDurationMs,
              createdLive: batch.createdLive,
              debugAudioPath: null,
              createdAt: now,
              queuedAt: null,
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

    async updateBatchDebugAudioPaths(updates) {
      db.transaction(() => {
        for (const update of updates) {
          db.update(transcriptionBatches)
            .set({ debugAudioPath: update.debugAudioPath })
            .where(eq(transcriptionBatches.id, update.batchId))
            .run();
        }
      });
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
