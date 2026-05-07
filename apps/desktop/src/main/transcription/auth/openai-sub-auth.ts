import { chmod, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const tokenUrl = 'https://auth.openai.com/oauth/token';
const clientId = 'app_EMoamEEZ73f0CkXaXp7hrann';
const jwtClaimPath = 'https://api.openai.com/auth';
const expirySkewMs = 60_000;

type OpenAiSubCredential = {
  type: 'oauth';
  access: string;
  refresh: string;
  expires?: number;
  accountId?: string;
};

type AuthStorage = Record<string, unknown>;

export interface OpenAiSubCredentials {
  accessToken: string;
  accountId: string | null;
}

export interface OpenAiSubAuthResolver {
  resolveCredentials: () => Promise<OpenAiSubCredentials>;
}

function getDefaultAuthPath() {
  return join(homedir(), '.pi', 'agent', 'auth.json');
}

function getProviderKeys() {
  const configuredKey = process.env.TOPH_OPENAI_SUB_AUTH_PROVIDER_KEY;
  return configuredKey ? [configuredKey] : ['openai-sub', 'openai-codex'];
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getAccountId(accessToken: string) {
  const payload = decodeJwtPayload(accessToken);
  const authClaim = payload?.[jwtClaimPath];
  if (typeof authClaim !== 'object' || authClaim === null) {
    return null;
  }

  const accountId = (authClaim as { chatgpt_account_id?: unknown }).chatgpt_account_id;
  return typeof accountId === 'string' && accountId.length > 0 ? accountId : null;
}

function isOpenAiSubCredential(value: unknown): value is OpenAiSubCredential {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const credential = value as Partial<OpenAiSubCredential>;
  return credential.type === 'oauth' && typeof credential.access === 'string' && typeof credential.refresh === 'string';
}

async function readAuthStorage(authPath: string): Promise<AuthStorage> {
  return JSON.parse(await readFile(authPath, 'utf8')) as AuthStorage;
}

async function writeAuthStorage(authPath: string, storage: AuthStorage) {
  await writeFile(authPath, `${JSON.stringify(storage, null, 2)}\n`, { mode: 0o600 });
  await chmod(authPath, 0o600);
}

async function refreshCredentials(refreshToken: string): Promise<OpenAiSubCredential> {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-sub token refresh failed: HTTP ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };

  if (
    typeof json.access_token !== 'string' ||
    typeof json.refresh_token !== 'string' ||
    typeof json.expires_in !== 'number'
  ) {
    throw new Error('OpenAI-sub token refresh response did not include expected token fields.');
  }

  return {
    type: 'oauth',
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
    accountId: getAccountId(json.access_token) ?? undefined,
  };
}

export function createOpenAiSubAuthResolver(options?: { authPath?: string }): OpenAiSubAuthResolver {
  const authPath = options?.authPath ?? process.env.TOPH_OPENAI_SUB_AUTH_PATH ?? getDefaultAuthPath();

  return {
    async resolveCredentials() {
      const storage = await readAuthStorage(authPath);
      const providerKey = getProviderKeys().find((key) => isOpenAiSubCredential(storage[key]));
      if (!providerKey) {
        throw new Error(`OpenAI-sub credentials were not found in ${authPath}.`);
      }

      let credential = storage[providerKey] as OpenAiSubCredential;
      if (typeof credential.expires === 'number' && credential.expires <= Date.now() + expirySkewMs) {
        credential = await refreshCredentials(credential.refresh);
        storage[providerKey] = credential;
        await writeAuthStorage(authPath, storage);
      }

      return {
        accessToken: credential.access,
        accountId: credential.accountId ?? getAccountId(credential.access),
      };
    },
  };
}
