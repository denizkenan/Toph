import { randomUUID } from 'node:crypto';

import type { RecordingSessionStore } from '../stores/session-store';

export interface SessionOutputService {
  createRawConcatOutput: (sessionId: string) => Promise<{ id: string; text: string; createdAt: number }>;
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
    'listOrderedBatchTranscriptTexts' | 'createSelectedSessionOutput'
  >;
}): SessionOutputService {
  return {
    async createRawConcatOutput(sessionId) {
      const text = assembleRawText(await options.sessionStore.listOrderedBatchTranscriptTexts(sessionId));
      if (!text) {
        throw new Error(`Session ${sessionId} does not have batch transcripts to assemble.`);
      }

      const output = {
        id: createSessionOutputId(),
        sessionId,
        kind: 'raw_concat' as const,
        text,
        createdAt: Date.now(),
      };

      await options.sessionStore.createSelectedSessionOutput(output);
      return { id: output.id, text: output.text, createdAt: output.createdAt };
    },
  };
}
