import type { SessionOutputService } from '../outputs/session-output-service';
import type { AppSettingsStore } from '../settings/app-settings-store';
import type { RecordingSessionStore } from '../stores/session-store';
import type { InferenceProvider, InferenceProviderResult } from '../inference/inference-provider';

export interface PolishService {
  polishOutput: (input: {
    sessionId: string;
    rawOutput: { id: string; text: string };
    signal?: AbortSignal;
  }) => Promise<{ id: string; text: string; createdAt: number; promptId: string; promptHash: string }>;
}

const maxAttempts = 3;
const retryDelayMs = 1_000;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Polish was aborted.'));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new Error('Polish was aborted.'));
      },
      { once: true },
    );
  });
}

function wrapTranscriptForPolish(text: string) {
  return `Rewrite this dictation transcript:\n\n<transcript>\n${text}\n</transcript>`;
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown Polish error.';
}

function isTransientInferenceFailure(error: unknown) {
  return error instanceof Error && error.name === 'TransientInferenceProviderError';
}

export function createPolishService(options: {
  settingsStore: Pick<AppSettingsStore, 'getSettings'>;
  sessionStore: Pick<RecordingSessionStore, 'getPolishPrompt'>;
  outputs: Pick<SessionOutputService, 'createPolishedOutput'>;
  inference: InferenceProvider;
}): PolishService {
  return {
    async polishOutput(input) {
      const settings = options.settingsStore.getSettings();
      const prompt = await options.sessionStore.getPolishPrompt(settings.polish.promptId);
      if (!prompt) {
        throw new Error(`Active Polish prompt "${settings.polish.promptId}" is not available.`);
      }
      if (!prompt.body) {
        throw new Error(`Active Polish prompt "${settings.polish.promptId}" is empty.`);
      }

      let attempt = 0;
      let lastError: unknown = null;
      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          const result = await options.inference.inferText({
            instructions: prompt.body,
            inputText: wrapTranscriptForPolish(input.rawOutput.text),
            signal: input.signal,
          });
          return options.outputs.createPolishedOutput({
            sessionId: input.sessionId,
            sourceOutputId: input.rawOutput.id,
            text: result.text,
            provider: result.provider,
            model: result.model,
            promptId: prompt.id,
            promptHash: prompt.bodyHash,
          });
        } catch (error) {
          lastError = error;
          if (!isTransientInferenceFailure(error) || attempt >= maxAttempts) {
            break;
          }

          await sleep(retryDelayMs * attempt, input.signal);
        }
      }

      throw new Error(`Polish failed after ${attempt} attempt${attempt === 1 ? '' : 's'}: ${describeError(lastError)}`);
    },
  };
}

export type { InferenceProviderResult };
