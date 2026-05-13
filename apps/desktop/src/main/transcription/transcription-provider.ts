import type { CostSource } from '../pricing/pricing-service';

export interface TranscriptionProviderResult {
  text: string;
  provider: string;
  model: string | null;
  estimatedBillableDurationMs: number;
  billableDurationMs: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  costUsdMicros: number;
  costSource: CostSource;
  pricingCatalogProviderId: string | null;
  pricingCatalogModelId: string | null;
  providerRequestId: string | null;
  providerResponseJson: unknown;
}

export interface TranscriptionProvider {
  id: string;
  transcribeBatch: (input: {
    batchId: string;
    audioPath: string;
    durationMs: number;
    signal?: AbortSignal;
  }) => Promise<TranscriptionProviderResult>;
}

export class TransientTranscriptionProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientTranscriptionProviderError';
  }
}

export function isTransientTranscriptionProviderError(
  error: unknown,
): error is TransientTranscriptionProviderError {
  return error instanceof TransientTranscriptionProviderError;
}
