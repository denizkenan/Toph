import type { ProviderBillingMode } from '@toph/desktop-contracts';

import type { CostSource } from './pricing/pricing-service';

export interface ProviderUsageDetails {
  billingMode: ProviderBillingMode;
  audioDurationMs: number | null;
  billableDurationMs: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsdMicros: number;
  costSource: CostSource;
  pricingCatalogProviderId: string | null;
  pricingCatalogModelId: string | null;
}
