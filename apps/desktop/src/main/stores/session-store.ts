import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { MAX_POLISH_RULE_PRESETS, type DashboardStats } from '@toph/desktop-contracts';

import {
  batchTranscripts,
  batchSourceRanges,
  dictionaryEntries,
  recordingSessions,
  polishRulePresets,
  sessionOutputs,
  timelineRegions,
  transcriptionBatches,
  type BatchTranscript,
  type DictionaryEntry,
  type PolishRulePreset,
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
  markPolishing: (sessionId: string) => Promise<void>;
  markNoSpeech: (sessionId: string) => Promise<void>;
  markFailed: (options: { sessionId: string; errorMessage: string }) => Promise<void>;
  // A recorded session with an error is recoverable because the raw WAV exists.
  markRecordedWithProcessingError: (options: {
    sessionId: string;
    errorMessage: string;
  }) => Promise<void>;
  markRecordingFailed: (options: {
    sessionId: string;
    errorMessage: string;
    endedAt?: number;
  }) => Promise<void>;
  markCancelled: (options: {
    sessionId: string;
    endedAt?: number;
    durationMs?: number;
  }) => Promise<void>;
  discardSessionArtifacts: (sessionId: string) => Promise<void>;
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
  updateBatchDerivedAudioPaths: (
    updates: Array<{ batchId: string; derivedAudioPath: string }>,
  ) => Promise<void>;
  getTranscriptionBatch: (batchId: string) => Promise<TranscriptionBatch | null>;
  listTranscriptionBatchesForSession: (sessionId: string) => Promise<TranscriptionBatch[]>;
  markBatchTranscribing: (options: {
    batchId: string;
    attempts: number;
    startedAt: number;
  }) => Promise<void>;
  markBatchTranscribed: (options: { batchId: string; transcribedAt: number }) => Promise<void>;
  markBatchFailed: (options: {
    batchId: string;
    attempts: number;
    errorMessage: string;
  }) => Promise<void>;
  insertBatchTranscript: (transcript: BatchTranscript) => Promise<void>;
  listOrderedBatchTranscriptTexts: (sessionId: string) => Promise<string[]>;
  createSessionOutput: (output: SessionOutput) => Promise<void>;
  selectSessionOutput: (options: { sessionId: string; outputId: string }) => Promise<void>;
  listRecentSelectedSessionOutputs: (limit: number) => Promise<SessionOutput[]>;
  getDashboardStats: (options: {
    now: number;
    rollingWindowDays: number;
    typingWpm: number;
  }) => Promise<DashboardStats>;
  syncDefaultPolishRulePreset: (rulePreset: {
    id: string;
    title: string;
    description: string;
    body: string;
    bodyHash: string;
    sortOrder: number;
  }) => Promise<PolishRulePreset>;
  listPolishRulePresets: () => Promise<PolishRulePreset[]>;
  getPolishRulePreset: (rulePresetId: string) => Promise<PolishRulePreset | null>;
  createPolishRulePreset: (draft: {
    title: string;
    description: string;
    body: string;
    bodyHash: string;
  }) => Promise<PolishRulePreset>;
  updatePolishRulePreset: (
    id: string,
    draft: { title: string; description: string; body: string; bodyHash: string },
  ) => Promise<PolishRulePreset>;
  duplicatePolishRulePreset: (id: string) => Promise<PolishRulePreset>;
  reorderPolishRulePresets: (ids: string[]) => Promise<void>;
  deletePolishRulePreset: (id: string) => Promise<void>;
  listDictionaryEntries: () => Promise<DictionaryEntry[]>;
  createDictionaryEntry: (draft: {
    term: string;
    hint: string | null;
    enabled: boolean;
  }) => Promise<DictionaryEntry>;
  updateDictionaryEntry: (
    id: string,
    draft: { term: string; hint: string | null; enabled: boolean },
  ) => Promise<DictionaryEntry>;
  deleteDictionaryEntry: (id: string) => Promise<void>;
  getLegacyPolishSettings: () => Promise<{
    enabled: boolean;
    activeRulePresetId: string | null;
  } | null>;
  pruneRetainedSessions: () => Promise<void>;
  close: () => void;
}

const retainedSessionCount = 10;
const retainableSessionStatuses = [
  'recorded',
  'segmented',
  'completed',
  'failed',
  'no_speech',
  'recording_failed',
] as const;

function createSessionId() {
  return `session_${Date.now()}_${randomUUID()}`;
}

function createRowId(prefix: string) {
  return `${prefix}_${Date.now()}_${randomUUID()}`;
}

function createSessionStoreDatabase(options: { databasePath: string; migrationsFolder: string }): {
  sqlite: Database.Database;
  db: BetterSQLite3Database;
} {
  const sqlite = new Database(options.databasePath);
  sqlite.pragma('journal_mode = WAL');

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: options.migrationsFolder });
  ensureCurrentWritableSchema(sqlite);

  return { sqlite, db };
}

function columnExists(sqlite: Database.Database, table: string, column: string) {
  return sqlite
    .prepare(`pragma table_info(${table})`)
    .all()
    .some((row) => {
      return typeof row === 'object' && row !== null && (row as { name?: unknown }).name === column;
    });
}

function ensureCurrentWritableSchema(sqlite: Database.Database) {
  if (!columnExists(sqlite, 'polish_rule_presets', 'description')) {
    sqlite.exec("alter table polish_rule_presets add column description text not null default ''");
  }
  if (!columnExists(sqlite, 'polish_rule_presets', 'sort_order')) {
    sqlite.exec('alter table polish_rule_presets add column sort_order integer not null default 0');
  }
  const transcriptColumns = [
    ['billable_duration_ms', 'integer'],
    ['input_tokens', 'integer'],
    ['cached_input_tokens', 'integer'],
    ['output_tokens', 'integer'],
    ['cost_usd_micros', 'integer not null default 0'],
    ['cost_source', "text not null default 'none'"],
    ['pricing_catalog_provider_id', 'text'],
    ['pricing_catalog_model_id', 'text'],
  ] as const;
  for (const [column, definition] of transcriptColumns) {
    if (!columnExists(sqlite, 'batch_transcripts', column)) {
      sqlite.exec(`alter table batch_transcripts add column ${column} ${definition}`);
    }
  }
  const outputColumns = [
    ['input_tokens', 'integer'],
    ['cached_input_tokens', 'integer'],
    ['output_tokens', 'integer'],
    ['cost_usd_micros', 'integer not null default 0'],
    ['cost_source', "text not null default 'none'"],
    ['pricing_catalog_provider_id', 'text'],
    ['pricing_catalog_model_id', 'text'],
  ] as const;
  for (const [column, definition] of outputColumns) {
    if (!columnExists(sqlite, 'session_outputs', column)) {
      sqlite.exec(`alter table session_outputs add column ${column} ${definition}`);
    }
  }
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

  const clearSessionGeneratedData = (sessionId: string) => {
    db.transaction(() => {
      const batches = db
        .select({ id: transcriptionBatches.id })
        .from(transcriptionBatches)
        .where(eq(transcriptionBatches.sessionId, sessionId))
        .all();
      const batchIds = batches.map((batch) => batch.id);

      if (batchIds.length > 0) {
        db.delete(batchTranscripts).where(inArray(batchTranscripts.batchId, batchIds)).run();
        db.delete(batchSourceRanges).where(inArray(batchSourceRanges.batchId, batchIds)).run();
      }

      db.delete(transcriptionBatches).where(eq(transcriptionBatches.sessionId, sessionId)).run();
      db.delete(timelineRegions).where(eq(timelineRegions.sessionId, sessionId)).run();
      db.delete(sessionOutputs).where(eq(sessionOutputs.sessionId, sessionId)).run();
    });
  };

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
      return (
        db.select().from(recordingSessions).where(eq(recordingSessions.id, sessionId)).get() ?? null
      );
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

    async markPolishing(sessionId) {
      db.update(recordingSessions)
        .set({
          status: 'polishing',
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

    async markFailed({ sessionId, errorMessage }) {
      db.update(recordingSessions)
        .set({
          status: 'failed',
          errorMessage,
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

    async markCancelled({ sessionId, endedAt, durationMs }) {
      const session = db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, sessionId))
        .get();
      if (!session) {
        return;
      }

      db.update(recordingSessions)
        .set({
          endedAt: session.endedAt ?? endedAt ?? Date.now(),
          durationMs: session.durationMs ?? durationMs ?? null,
          status: 'cancelled',
          selectedOutputId: null,
          errorMessage: null,
        })
        .where(eq(recordingSessions.id, sessionId))
        .run();
    },

    async discardSessionArtifacts(sessionId) {
      const session = db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, sessionId))
        .get();
      if (!session) {
        return;
      }

      clearSessionGeneratedData(sessionId);
      await rm(dirname(session.rawAudioPath), { recursive: true, force: true });
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
      clearSessionGeneratedData(sessionId);
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
      return (
        db.select().from(transcriptionBatches).where(eq(transcriptionBatches.id, batchId)).get() ??
        null
      );
    },

    async listTranscriptionBatchesForSession(sessionId) {
      return db
        .select()
        .from(transcriptionBatches)
        .where(eq(transcriptionBatches.sessionId, sessionId))
        .all();
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

    async createSessionOutput(output) {
      db.insert(sessionOutputs).values(output).run();
    },

    async selectSessionOutput({ sessionId, outputId }) {
      db.transaction(() => {
        db.update(recordingSessions)
          .set({
            status: 'completed',
            selectedOutputId: outputId,
            errorMessage: null,
          })
          .where(eq(recordingSessions.id, sessionId))
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
          sourceOutputId: sessionOutputs.sourceOutputId,
          provider: sessionOutputs.provider,
          model: sessionOutputs.model,
          rulePresetId: sessionOutputs.rulePresetId,
          rulePresetHash: sessionOutputs.rulePresetHash,
          inputTokens: sessionOutputs.inputTokens,
          cachedInputTokens: sessionOutputs.cachedInputTokens,
          outputTokens: sessionOutputs.outputTokens,
          costUsdMicros: sessionOutputs.costUsdMicros,
          costSource: sessionOutputs.costSource,
          pricingCatalogProviderId: sessionOutputs.pricingCatalogProviderId,
          pricingCatalogModelId: sessionOutputs.pricingCatalogModelId,
          createdAt: sessionOutputs.createdAt,
        })
        .from(sessionOutputs)
        .innerJoin(recordingSessions, eq(recordingSessions.selectedOutputId, sessionOutputs.id))
        .where(eq(recordingSessions.status, 'completed'))
        .orderBy(desc(sessionOutputs.createdAt))
        .limit(limit)
        .all();
    },

    async getDashboardStats({ now, rollingWindowDays, typingWpm }) {
      const threshold = now - rollingWindowDays * 24 * 60 * 60 * 1000;
      const selectedOutputs = sqlite
        .prepare(`
          select so.text, so.cost_usd_micros as outputCostUsdMicros, so.session_id as sessionId
          from session_outputs so
          inner join recording_sessions rs on rs.selected_output_id = so.id
          where rs.status = 'completed' and so.created_at >= ?
        `)
        .all(threshold) as Array<{
        text: string;
        outputCostUsdMicros: number | null;
        sessionId: string;
      }>;

      const sessionIds = selectedOutputs.map((output) => output.sessionId);
      let derivedAudioDurationMs = 0;
      let transcriptCostUsdMicros = 0;
      if (sessionIds.length > 0) {
        const placeholders = sessionIds.map(() => '?').join(',');
        const durationRow = sqlite
          .prepare(
            `select coalesce(sum(derived_audio_duration_ms), 0) as total from transcription_batches where session_id in (${placeholders})`,
          )
          .get(...sessionIds) as { total: number } | undefined;
        const costRow = sqlite
          .prepare(`
            select coalesce(sum(bt.cost_usd_micros), 0) as total
            from batch_transcripts bt
            inner join transcription_batches tb on tb.id = bt.batch_id
            where tb.session_id in (${placeholders})
          `)
          .get(...sessionIds) as { total: number } | undefined;
        derivedAudioDurationMs = durationRow?.total ?? 0;
        transcriptCostUsdMicros = costRow?.total ?? 0;
      }

      const words = selectedOutputs.reduce((total, output) => {
        const trimmed = output.text.trim();
        return total + (trimmed ? trimmed.split(/\s+/).length : 0);
      }, 0);
      const averageSpokenWpm =
        words > 0 && derivedAudioDurationMs > 0 ? words / (derivedAudioDurationMs / 60_000) : null;
      const typingMinutes = words / typingWpm;
      const speakingMinutes = averageSpokenWpm ? words / averageSpokenWpm : 0;

      return {
        rollingWindowDays,
        words,
        averageSpokenWpm,
        timeSavedMinutes: Math.max(0, typingMinutes - speakingMinutes),
        costUsdMicros:
          transcriptCostUsdMicros +
          selectedOutputs.reduce((total, output) => total + (output.outputCostUsdMicros ?? 0), 0),
      };
    },

    async syncDefaultPolishRulePreset(rulePreset) {
      const now = Date.now();
      const existing = db
        .select()
        .from(polishRulePresets)
        .where(eq(polishRulePresets.id, rulePreset.id))
        .get();
      if (!existing) {
        const inserted = {
          id: rulePreset.id,
          title: rulePreset.title,
          description: rulePreset.description,
          body: rulePreset.body,
          bodyHash: rulePreset.bodyHash,
          isBuiltin: false,
          sortOrder: rulePreset.sortOrder,
          createdAt: now,
          updatedAt: now,
        };
        db.insert(polishRulePresets).values(inserted).run();
        return inserted;
      }

      if (
        existing.description.trim().length === 0 ||
        (existing.sortOrder === 0 && rulePreset.sortOrder > 0)
      ) {
        const updated = {
          ...existing,
          description:
            existing.description.trim().length === 0
              ? rulePreset.description
              : existing.description,
          sortOrder:
            existing.sortOrder === 0 && rulePreset.sortOrder > 0
              ? rulePreset.sortOrder
              : existing.sortOrder,
          updatedAt: now,
        };
        db.update(polishRulePresets)
          .set({
            description: updated.description,
            sortOrder: updated.sortOrder,
            updatedAt: updated.updatedAt,
          })
          .where(eq(polishRulePresets.id, rulePreset.id))
          .run();
        return updated;
      }

      return existing;
    },

    async listPolishRulePresets() {
      return db
        .select()
        .from(polishRulePresets)
        .orderBy(asc(polishRulePresets.sortOrder), asc(polishRulePresets.title))
        .all();
    },

    async getPolishRulePreset(rulePresetId) {
      return (
        db.select().from(polishRulePresets).where(eq(polishRulePresets.id, rulePresetId)).get() ??
        null
      );
    },

    async createPolishRulePreset(draft) {
      const existingCount = db.select().from(polishRulePresets).all().length;
      if (existingCount >= MAX_POLISH_RULE_PRESETS) {
        throw new Error(`Only ${MAX_POLISH_RULE_PRESETS} writing rules can exist at once.`);
      }

      const now = Date.now();
      const preset = {
        id: createRowId('rule_preset'),
        title: draft.title,
        description: draft.description,
        body: draft.body,
        bodyHash: draft.bodyHash,
        isBuiltin: false,
        sortOrder: existingCount,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(polishRulePresets).values(preset).run();
      return preset;
    },

    async updatePolishRulePreset(id, draft) {
      const existing = db
        .select()
        .from(polishRulePresets)
        .where(eq(polishRulePresets.id, id))
        .get();
      if (!existing) {
        throw new Error(`Polish rule preset "${id}" is not available.`);
      }

      const updated = {
        ...existing,
        title: draft.title,
        description: draft.description,
        body: draft.body,
        bodyHash: draft.bodyHash,
        updatedAt: Date.now(),
      };
      db.update(polishRulePresets)
        .set({
          title: updated.title,
          description: updated.description,
          body: updated.body,
          bodyHash: updated.bodyHash,
          updatedAt: updated.updatedAt,
        })
        .where(eq(polishRulePresets.id, id))
        .run();
      return updated;
    },

    async duplicatePolishRulePreset(id) {
      const existing = db
        .select()
        .from(polishRulePresets)
        .where(eq(polishRulePresets.id, id))
        .get();
      if (!existing) {
        throw new Error(`Polish rule preset "${id}" is not available.`);
      }
      const existingCount = db.select().from(polishRulePresets).all().length;
      if (existingCount >= MAX_POLISH_RULE_PRESETS) {
        throw new Error(`Only ${MAX_POLISH_RULE_PRESETS} writing rules can exist at once.`);
      }

      const now = Date.now();
      const preset = {
        id: createRowId('rule_preset'),
        title: `${existing.title} copy`,
        description: existing.description,
        body: existing.body,
        bodyHash: existing.bodyHash,
        isBuiltin: false,
        sortOrder: existingCount,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(polishRulePresets).values(preset).run();
      return preset;
    },

    async reorderPolishRulePresets(ids) {
      const existing = db
        .select()
        .from(polishRulePresets)
        .orderBy(asc(polishRulePresets.sortOrder))
        .all();
      const existingIds = existing.map((preset) => preset.id);
      const uniqueIds = new Set(ids);
      if (
        ids.length !== existingIds.length ||
        uniqueIds.size !== ids.length ||
        ids.some((id) => !existingIds.includes(id))
      ) {
        throw new Error('Rule order must include every writing rule exactly once.');
      }

      db.transaction(() => {
        ids.forEach((id, index) => {
          db.update(polishRulePresets)
            .set({ sortOrder: index, updatedAt: Date.now() })
            .where(eq(polishRulePresets.id, id))
            .run();
        });
      });
    },

    async deletePolishRulePreset(id) {
      const existing = db
        .select()
        .from(polishRulePresets)
        .orderBy(asc(polishRulePresets.sortOrder))
        .all();
      if (!existing.some((preset) => preset.id === id)) {
        return;
      }
      if (existing.length <= 1) {
        throw new Error('At least one writing rule must remain.');
      }

      db.transaction(() => {
        db.delete(polishRulePresets).where(eq(polishRulePresets.id, id)).run();
        existing
          .filter((preset) => preset.id !== id)
          .forEach((preset, index) => {
            db.update(polishRulePresets)
              .set({ sortOrder: index })
              .where(eq(polishRulePresets.id, preset.id))
              .run();
          });
      });
    },

    async listDictionaryEntries() {
      return db.select().from(dictionaryEntries).orderBy(asc(dictionaryEntries.term)).all();
    },

    async createDictionaryEntry(draft) {
      const now = Date.now();
      const entry = {
        id: createRowId('dictionary_entry'),
        term: draft.term,
        hint: draft.hint,
        enabled: draft.enabled,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(dictionaryEntries).values(entry).run();
      return entry;
    },

    async updateDictionaryEntry(id, draft) {
      const existing = db
        .select()
        .from(dictionaryEntries)
        .where(eq(dictionaryEntries.id, id))
        .get();
      if (!existing) {
        throw new Error(`Dictionary entry "${id}" is not available.`);
      }

      const updated = {
        ...existing,
        term: draft.term,
        hint: draft.hint,
        enabled: draft.enabled,
        updatedAt: Date.now(),
      };
      db.update(dictionaryEntries)
        .set({
          term: updated.term,
          hint: updated.hint,
          enabled: updated.enabled,
          updatedAt: updated.updatedAt,
        })
        .where(eq(dictionaryEntries.id, id))
        .run();
      return updated;
    },

    async deleteDictionaryEntry(id) {
      db.delete(dictionaryEntries).where(eq(dictionaryEntries.id, id)).run();
    },

    async getLegacyPolishSettings() {
      const table = sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = 'polish_settings'")
        .get();
      if (!table) {
        return null;
      }

      const row = sqlite
        .prepare('select enabled, active_prompt_id from polish_settings where id = ?')
        .get('polish') as { enabled?: unknown; active_prompt_id?: unknown } | undefined;
      if (!row || typeof row.active_prompt_id !== 'string') {
        return null;
      }

      return {
        enabled: Boolean(row.enabled),
        activeRulePresetId: row.active_prompt_id,
      };
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
