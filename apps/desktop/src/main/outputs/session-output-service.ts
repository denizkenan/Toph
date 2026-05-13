import { randomUUID } from 'node:crypto';

import type { CostSource } from '../pricing/pricing-service';
import type { RecordingSessionStore } from '../stores/session-store';

export interface SessionOutputService {
  createRawConcatOutput: (
    sessionId: string,
  ) => Promise<{ id: string; text: string; createdAt: number }>;
  createPolishedOutput: (options: {
    sessionId: string;
    sourceOutputId: string;
    text: string;
    provider: string;
    model: string | null;
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    costUsdMicros: number;
    costSource: CostSource;
    pricingCatalogProviderId: string | null;
    pricingCatalogModelId: string | null;
    rulePresetId: string;
    rulePresetHash: string;
  }) => Promise<{
    id: string;
    text: string;
    createdAt: number;
    rulePresetId: string;
    rulePresetHash: string;
  }>;
  selectOutput: (options: { sessionId: string; outputId: string }) => Promise<void>;
}

function createSessionOutputId() {
  return `session_output_${Date.now()}_${randomUUID()}`;
}

function assembleRawText(texts: string[]) {
  return texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createSessionOutputService(options: {
  sessionStore: Pick<
    RecordingSessionStore,
    'listOrderedBatchTranscriptTexts' | 'createSessionOutput' | 'selectSessionOutput'
  >;
}): SessionOutputService {
  return {
    async createRawConcatOutput(sessionId) {
      const text = assembleRawText(
        await options.sessionStore.listOrderedBatchTranscriptTexts(sessionId),
      );
      if (!text) {
        throw new Error(`Session ${sessionId} does not have batch transcripts to assemble.`);
      }

      const output = {
        id: createSessionOutputId(),
        sessionId,
        kind: 'raw_concat' as const,
        text,
        sourceOutputId: null,
        provider: null,
        model: null,
        rulePresetId: null,
        rulePresetHash: null,
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        costUsdMicros: 0,
        costSource: 'none' as const,
        pricingCatalogProviderId: null,
        pricingCatalogModelId: null,
        createdAt: Date.now(),
      };

      await options.sessionStore.createSessionOutput(output);
      return { id: output.id, text: output.text, createdAt: output.createdAt };
    },

    async createPolishedOutput(input) {
      const text = input.text.trim();
      if (!text) {
        throw new Error(`Session ${input.sessionId} produced an empty polished output.`);
      }

      const output = {
        id: createSessionOutputId(),
        sessionId: input.sessionId,
        kind: 'polished' as const,
        text,
        sourceOutputId: input.sourceOutputId,
        provider: input.provider,
        model: input.model,
        rulePresetId: input.rulePresetId,
        rulePresetHash: input.rulePresetHash,
        inputTokens: input.inputTokens,
        cachedInputTokens: input.cachedInputTokens,
        outputTokens: input.outputTokens,
        costUsdMicros: input.costUsdMicros,
        costSource: input.costSource,
        pricingCatalogProviderId: input.pricingCatalogProviderId,
        pricingCatalogModelId: input.pricingCatalogModelId,
        createdAt: Date.now(),
      };

      await options.sessionStore.createSessionOutput(output);
      return {
        id: output.id,
        text: output.text,
        createdAt: output.createdAt,
        rulePresetId: output.rulePresetId,
        rulePresetHash: output.rulePresetHash,
      };
    },

    async selectOutput(input) {
      await options.sessionStore.selectSessionOutput(input);
    },
  };
}
