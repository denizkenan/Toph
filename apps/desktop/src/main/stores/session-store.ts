import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';
import { desc, eq, inArray } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { recordingSessions, type RecordingSession } from '../db/schema';
import type { TophDataPaths } from '../paths';

export interface RecordingSessionStore {
  createRecordingSession: () => Promise<RecordingSession>;
  markRecorded: (options: {
    sessionId: string;
    endedAt: number;
    durationMs: number;
  }) => Promise<void>;
  markFailed: (options: { sessionId: string; errorMessage: string; endedAt?: number }) => Promise<void>;
  pruneRetainedSessions: () => Promise<void>;
  close: () => void;
}

const retainedSessionCount = 10;
const retainableSessionStatuses = ['recorded', 'failed'] as const;

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
