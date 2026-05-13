import type { CostSource } from '../pricing/pricing-service';

export interface InferenceProviderResult {
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
  providerRequestId: string | null;
  providerResponseJson: unknown;
}

export interface InferenceProvider {
  id: string;
  inferText: (input: {
    instructions: string;
    inputText: string;
    signal?: AbortSignal;
  }) => Promise<InferenceProviderResult>;
}

export class TransientInferenceProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientInferenceProviderError';
  }
}

export function isTransientInferenceProviderError(
  error: unknown,
): error is TransientInferenceProviderError {
  return error instanceof TransientInferenceProviderError;
}
