import { act, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import type { AppState, DesktopApi } from '@toph/desktop-contracts';

import { HomeApp } from './home-app';

const baseState: AppState = {
  phase: 'idle',
  shortcut: {
    chord: { modifiers: ['control', 'alt'], key: 'Space' },
    accelerator: 'Control+Alt+Space',
    label: 'Ctrl+Alt+Space',
    registered: true,
    backend: 'electron-global-shortcut',
    detail: 'Electron global shortcut registration is active.',
    installable: true,
    installed: true,
  },
  environment: {
    platform: 'linux',
    sessionType: 'wayland',
    currentDesktop: 'GNOME',
  },
  providers: {
    ready: true,
    selectedProviderId: 'openai-sub',
    providers: [
      {
        id: 'openai-sub',
        label: 'OpenAI (ChatGPT Plus/Pro subscription)',
        description: 'Use your ChatGPT subscription to transcribe recordings.',
        status: 'connected',
        accountId: 'account-id',
        expires: Date.now() + 3_600_000,
        error: null,
      },
    ],
  },
  settings: {
    version: 1,
    shortcut: { chord: { modifiers: ['control', 'alt'], key: 'Space' } },
    auth: { providerId: 'openai-sub' },
    transcription: { providerId: 'openai-sub', model: 'chatgpt-backend-transcribe' },
    inference: { providerId: 'openai-sub', model: 'gpt-5.4-mini' },
    polish: { enabled: true, promptId: 'default' },
  },
  polish: {
    prompts: [{ id: 'default', title: 'Default', bodyHash: 'hash', isBuiltin: true }],
  },
  permissions: {
    ready: true,
    requirements: [],
  },
  pasteSupport: {
    helper: 'ydotool',
    detail: 'Clipboard-first mode is active. Auto-paste will be attempted with ydotool.',
  },
  lastPasteAttempt: {
    helper: 'ydotool',
    status: 'idle',
    detail: 'No transcript has been pasted yet.',
  },
  lastTranscript: null,
  recentConversions: [],
  updatedAt: 1,
};

function createClient(state: AppState, overrides: Partial<DesktopApi> = {}): DesktopApi {
  return {
    subscribeState: (listener) => {
      listener(state);
      return () => {};
    },
    toggleCapture: async () => {},
    cancelCapture: async () => {},
    resizeOverlay: async () => {},
    showSettings: async () => {},
    hideSettings: async () => {},
    installShortcut: async () => {},
    suspendShortcut: async () => {},
    resumeShortcut: async () => {},
    connectProvider: async () => {},
    submitProviderAuthorization: async () => {},
    removeProvider: async () => {},
    refreshProviders: async () => {},
    setAuthProvider: async () => {},
    setTranscriptionProvider: async () => {},
    setTranscriptionModel: async () => {},
    setInferenceProvider: async () => {},
    setInferenceModel: async () => {},
    setPolishEnabled: async () => {},
    setActivePolishPrompt: async () => {},
    performPermissionAction: async () => {},
    refreshPermissions: async () => {},
    onSoundEvent: () => () => {},
    quit: async () => {},
    ...overrides,
  };
}

describe('HomeApp', () => {
  it('renders the home screen with empty state', async () => {
    render(<HomeApp client={createClient(baseState)} />);

    await screen.findByRole('heading', { name: 'Toph' });
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect(screen.getByText('All systems go')).toBeTruthy();
  });

  it('renders recent conversions when present', async () => {
    const stateWithConversions: AppState = {
      ...baseState,
      recentConversions: [
        {
          id: 'conv-1',
          text: 'This is a test dictation result from the mock flow.',
          kind: 'polished',
          promptId: 'default',
          promptHash: 'hash',
          createdAt: Date.now() - 120_000,
          pasteStatus: 'success',
          pasteDetail: 'Pasted via ydotool.',
        },
        {
          id: 'conv-2',
          text: 'Another dictation that failed to paste.',
          kind: 'raw_concat',
          promptId: null,
          promptHash: null,
          createdAt: Date.now() - 600_000,
          pasteStatus: 'failed',
          pasteDetail: 'ydotool timed out.',
        },
      ],
    };

    render(<HomeApp client={createClient(stateWithConversions)} />);

    await screen.findByText('This is a test dictation result from the mock flow.');
    expect(screen.getByText('Pasted')).toBeTruthy();
    expect(screen.getByText('Polish: default')).toBeTruthy();
    expect(screen.getByText('Paste failed')).toBeTruthy();
  });

  it('renders onboarding when required permissions are missing', async () => {
    render(
      <HomeApp
        client={createClient({
          ...baseState,
          environment: {
            ...baseState.environment,
            platform: 'darwin',
          },
          permissions: {
            ready: false,
            requirements: [
              {
                id: 'microphone',
                label: 'Microphone',
                status: 'promptable',
                required: true,
                detail: 'Toph needs microphone access before it can listen.',
                action: 'request',
              },
              {
                id: 'accessibility',
                label: 'Accessibility',
                status: 'missing',
                required: true,
                detail: 'Toph needs Accessibility access to paste for you.',
                action: 'open-settings',
              },
            ],
          },
        })}
      />,
    );

    await screen.findByRole('heading', { name: /Your fingers called/ });
    expect(screen.getByText(/Real-time voice transcription across all your apps/)).toBeTruthy();
    expect(screen.getByText(/Bring your own subscription/)).toBeTruthy();
    expect(screen.getByText('Microphone')).toBeTruthy();
    expect(screen.getByText('Accessibility')).toBeTruthy();
  });

  it('refreshes onboarding state when the window regains focus', async () => {
    const refreshPermissions = vi.fn<() => Promise<void>>(async () => {});
    const refreshProviders = vi.fn<() => Promise<void>>(async () => {});

    render(
      <HomeApp
        client={createClient(
          {
            ...baseState,
            permissions: {
              ready: false,
              requirements: [
                {
                  id: 'microphone',
                  label: 'Microphone',
                  status: 'promptable',
                  required: true,
                  detail: 'Toph needs microphone access before it can listen.',
                  action: 'request',
                },
              ],
            },
          },
          { refreshPermissions, refreshProviders },
        )}
      />,
    );

    await screen.findByRole('heading', { name: /Your fingers called/ });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(refreshPermissions).toHaveBeenCalledTimes(1);
      expect(refreshProviders).toHaveBeenCalledTimes(1);
    });
  });

  it('shows complete permissions when no requirements are needed', async () => {
    render(
      <HomeApp
        client={createClient({
          ...baseState,
          providers: {
            ...baseState.providers,
            ready: false,
            providers: [
              {
                ...baseState.providers.providers[0],
                status: 'missing',
              },
            ],
          },
          permissions: {
            ready: true,
            requirements: [],
          },
        })}
      />,
    );

    await screen.findByRole('heading', { name: /Your fingers called/ });
    expect(screen.getByText('No permissions needed')).toBeTruthy();
  });

  it('still refreshes providers when permission refresh fails', async () => {
    const refreshPermissions = vi.fn<() => Promise<void>>(async () => {
      throw new Error('permission refresh failed');
    });
    const refreshProviders = vi.fn<() => Promise<void>>(async () => {});

    render(
      <HomeApp
        client={createClient(
          {
            ...baseState,
            permissions: {
              ready: false,
              requirements: [
                {
                  id: 'microphone',
                  label: 'Microphone',
                  status: 'promptable',
                  required: true,
                  detail: 'Toph needs microphone access before it can listen.',
                  action: 'request',
                },
              ],
            },
          },
          { refreshPermissions, refreshProviders },
        )}
      />,
    );

    await screen.findByRole('heading', { name: /Your fingers called/ });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(refreshPermissions).toHaveBeenCalledTimes(1);
      expect(refreshProviders).toHaveBeenCalledTimes(1);
    });
    await screen.findByText(/Refresh could not verify everything/);
    await screen.findByRole('button', { name: 'Check again' });
  });
});
