import type { ProviderUsageDetails } from '../provider-usage';

export interface InferenceProviderResult {
  text: string;
  provider: string;
  model: string | null;
  usage: ProviderUsageDetails;
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
