import type { ProviderId, ProviderState } from '@toph/desktop-contracts';

import {
  readProviderAuthStorage,
  writeProviderAuthStorage,
  type OAuthProviderCredential,
  type ProviderAuthStorage,
} from './auth-storage';
import {
  createOpenAiSubOAuthFlow,
  refreshOpenAiSubOAuthToken,
  type OpenAiSubOAuthTokens,
  type PendingOpenAiSubOAuthFlow,
} from './providers/openai-sub-oauth-flow';

const providerId: ProviderId = 'openai-sub';
const providerLabel = 'OpenAI (ChatGPT Plus/Pro subscription)';
const providerDescription = 'Use your ChatGPT subscription to transcribe recordings.';
const expirySkewMs = 60_000;

export interface ProviderCredentials {
  accessToken: string;
  accountId: string | null;
}

export interface ProviderAuthService {
  getState: () => Promise<ProviderState>;
  resolveCredentials: (providerId: ProviderId) => Promise<ProviderCredentials>;
  connectProvider: (providerId: ProviderId) => Promise<ProviderState>;
  submitProviderAuthorization: (providerId: ProviderId, input: string) => Promise<ProviderState>;
  removeProvider: (providerId: ProviderId) => Promise<ProviderState>;
  refreshProviders: () => Promise<ProviderState>;
  dispose: () => Promise<void>;
}

class ProviderAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

function toCredential(tokens: OpenAiSubOAuthTokens): OAuthProviderCredential {
  return {
    type: 'oauth',
    access: tokens.access,
    refresh: tokens.refresh,
    expires: tokens.expires,
    accountId: tokens.accountId,
  };
}

function createProviderState(options: {
  credential: OAuthProviderCredential | null;
  connecting: boolean;
  error: string | null;
}): ProviderState {
  const status = options.connecting ? 'connecting' : options.credential ? 'connected' : options.error ? 'invalid' : 'missing';
  return {
    ready: status === 'connected',
    selectedProviderId: status === 'connected' ? providerId : null,
    providers: [
      {
        id: providerId,
        label: providerLabel,
        description: providerDescription,
        status,
        accountId: options.credential?.accountId ?? null,
        expires: options.credential?.expires ?? null,
        error: options.error,
      },
    ],
  };
}

function assertProviderId(id: ProviderId) {
  if (id !== providerId) {
    throw new ProviderAuthError('Unknown provider.');
  }
}

export function createProviderAuthService(options: {
  authPath: string;
  openExternal: (url: string) => Promise<void>;
  onStateChanged?: (state: ProviderState) => void;
}): ProviderAuthService {
  let pendingFlow: PendingOpenAiSubOAuthFlow | null = null;
  let pendingFlowSettled = true;
  let lastError: string | null = null;

  const readStorage = () => readProviderAuthStorage(options.authPath);

  const writeStorage = async (storage: ProviderAuthStorage) => {
    await writeProviderAuthStorage(options.authPath, storage);
  };

  const refreshCredential = async (credential: OAuthProviderCredential) => {
    const refreshed = toCredential(await refreshOpenAiSubOAuthToken(credential.refresh));
    return {
      ...refreshed,
      accountId: refreshed.accountId ?? credential.accountId,
    };
  };

  const readCurrentCredential = async () => {
    const storage = await readStorage();
    return storage[providerId] ?? null;
  };

  const refreshStoredCredentialIfExpired = async () => {
    const credential = await readCurrentCredential();
    if (!credential || credential.expires > Date.now() + expirySkewMs) {
      return;
    }

    try {
      await storeCredential(await refreshCredential(credential));
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Provider credentials could not be refreshed.';
      await writeStorage({});
    }
  };

  const stateFromDisk = async () => createProviderState({
    credential: await readCurrentCredential(),
    connecting: pendingFlow !== null,
    error: lastError,
  });

  const publishState = async () => {
    options.onStateChanged?.(await stateFromDisk());
  };

  const storeCredential = async (credential: OAuthProviderCredential) => {
    await writeStorage({ [providerId]: credential });
    lastError = null;
  };

  const completeLoginWithTokens = async (tokens: OpenAiSubOAuthTokens) => {
    await storeCredential(toCredential(tokens));
  };

  const runPendingLogin = async (flow: PendingOpenAiSubOAuthFlow) => {
    try {
      const tokens = await flow.waitForCallback();
      await completeLoginWithTokens(tokens);
    } catch (error) {
      if (await readCurrentCredential()) {
        return;
      }
      lastError = error instanceof Error ? error.message : 'Provider login failed.';
      throw error;
    } finally {
      if (pendingFlow === flow) {
        pendingFlow = null;
        pendingFlowSettled = true;
      }
      await flow.dispose().catch(() => {});
      await publishState();
    }
  };

  return {
    async getState() {
      await refreshStoredCredentialIfExpired();
      return stateFromDisk();
    },

    async resolveCredentials(id) {
      assertProviderId(id);
      const storage = await readStorage();
      let credential = storage[providerId];
      if (!credential) {
        throw new ProviderAuthError('Add a transcription provider before dictating.');
      }

      if (credential.expires <= Date.now() + expirySkewMs) {
        try {
          credential = await refreshCredential(credential);
          await storeCredential(credential);
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Provider credentials could not be refreshed.';
          await writeStorage({});
          await publishState();
          throw new ProviderAuthError('Provider credentials expired. Reconnect the provider to continue.');
        }
      }

      return {
        accessToken: credential.access,
        accountId: credential.accountId ?? null,
      };
    },

    async connectProvider(id) {
      assertProviderId(id);
      if (pendingFlow && !pendingFlowSettled) {
        return stateFromDisk();
      }

      lastError = null;
      pendingFlowSettled = false;
      try {
        pendingFlow = await createOpenAiSubOAuthFlow();
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Provider login could not start.';
        pendingFlow = null;
        pendingFlowSettled = true;
        await publishState();
        throw error;
      }
      const flow = pendingFlow;
      await publishState();
      try {
        await options.openExternal(flow.authorizationUrl);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Provider login could not open the browser.';
        pendingFlow = null;
        pendingFlowSettled = true;
        await flow.dispose().catch(() => {});
        await publishState();
        throw error;
      }
      await runPendingLogin(flow);
      return stateFromDisk();
    },

    async submitProviderAuthorization(id, input) {
      assertProviderId(id);
      if (!pendingFlow) {
        throw new ProviderAuthError('No provider login is waiting for an authorization code.');
      }

      try {
        const flow = pendingFlow;
        const tokens = await flow.exchangeAuthorizationInput(input);
        await completeLoginWithTokens(tokens);
        pendingFlow = null;
        pendingFlowSettled = true;
        await flow.dispose().catch(() => {});
        await publishState();
        return stateFromDisk();
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Provider login failed.';
        await publishState();
        throw error;
      }
    },

    async removeProvider(id) {
      assertProviderId(id);
      if (pendingFlow) {
        await pendingFlow.dispose().catch(() => {});
        pendingFlow = null;
        pendingFlowSettled = true;
      }
      lastError = null;
      await writeStorage({});
      await publishState();
      return stateFromDisk();
    },

    async refreshProviders() {
      lastError = null;
      await refreshStoredCredentialIfExpired();
      await publishState();
      return stateFromDisk();
    },

    async dispose() {
      await pendingFlow?.dispose().catch(() => {});
      pendingFlow = null;
    },
  };
}
