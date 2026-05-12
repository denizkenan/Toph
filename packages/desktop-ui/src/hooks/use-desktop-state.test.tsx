import { act, renderHook } from '@testing-library/react';

import type { AppState, DesktopApi } from '@toph/desktop-contracts';

import { useDesktopState, useRelativeTime } from './use-desktop-state';

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

function createClient(
  onSubscribe: (listener: (state: AppState) => void) => () => void,
): DesktopApi {
  return {
    subscribeState: onSubscribe,
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
  };
}

describe('useDesktopState', () => {
  it('starts empty, applies streamed snapshots, and unsubscribes on cleanup', () => {
    let publish: ((state: AppState) => void) | null = null;
    const unsubscribe = vi.fn<() => void>();
    const client = createClient((listener) => {
      publish = listener;
      return unsubscribe;
    });

    const { result, unmount } = renderHook(() => useDesktopState(client));

    expect(result.current).toBeNull();

    act(() => {
      publish?.(baseState);
    });

    expect(result.current).toEqual(baseState);

    act(() => {
      publish?.({
        ...baseState,
        phase: 'listening',
        updatedAt: 2,
      });
    });

    expect(result.current?.phase).toBe('listening');

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useRelativeTime', () => {
  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    const { result } = renderHook(() => useRelativeTime(Date.now() - 10_000));
    expect(result.current).toBe('just now');
  });

  it('returns minutes for timestamps between 1 and 59 minutes ago', () => {
    const { result } = renderHook(() => useRelativeTime(Date.now() - 5 * 60_000));
    expect(result.current).toBe('5 min ago');
  });

  it('returns hours for timestamps between 1 and 23 hours ago', () => {
    const { result } = renderHook(() => useRelativeTime(Date.now() - 3 * 3_600_000));
    expect(result.current).toBe('3 hrs ago');
  });

  it('returns "yesterday" for timestamps between 24 and 47 hours ago', () => {
    const { result } = renderHook(() => useRelativeTime(Date.now() - 30 * 3_600_000));
    expect(result.current).toBe('yesterday');
  });
});
