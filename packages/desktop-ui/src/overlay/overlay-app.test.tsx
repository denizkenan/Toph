import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, vi } from 'vitest';

import type { AppState, DesktopApi } from '@toph/desktop-contracts';

import { OverlayApp } from './overlay-app';

const baseState: AppState = {
  phase: 'transcribing',
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
    polish: { enabled: true, rulePresetId: 'general' },
  },
  polish: {
    rulePresets: [{ id: 'general', title: 'General', body: 'General rules', bodyHash: 'hash', isBuiltin: true }],
    dictionary: [],
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
    status: 'success',
    detail: 'Transcript copied to the clipboard and paste was attempted with ydotool.',
  },
  lastTranscript: 'hello',
  recentConversions: [],
  updatedAt: 1,
};

class TestResizeObserver {
  observe() {}
  disconnect() {}
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: TestResizeObserver,
    configurable: true,
  });
});

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
    setActivePolishRulePreset: async () => {},
    createPolishRulePreset: async () => {},
    updatePolishRulePreset: async () => {},
    deletePolishRulePreset: async () => {},
    createDictionaryEntry: async () => {},
    updateDictionaryEntry: async () => {},
    deleteDictionaryEntry: async () => {},
    performPermissionAction: async () => {},
    refreshPermissions: async () => {},
    onSoundEvent: () => () => {},
    quit: async () => {},
    ...overrides,
  };
}

describe('OverlayApp', () => {
  it('renders the idle ready indicator', async () => {
    render(
      <OverlayApp client={createClient({ ...baseState, phase: 'idle' })} soundsEnabled={false} />,
    );

    await screen.findByLabelText('Toph ready');
  });

  it('renders the transcribing state without Electron globals', async () => {
    render(<OverlayApp client={createClient(baseState)} soundsEnabled={false} />);

    await screen.findByRole('heading', { name: 'Transcribing...' });
  });

  it('renders the polishing state', async () => {
    render(
      <OverlayApp
        client={createClient({ ...baseState, phase: 'polishing' })}
        soundsEnabled={false}
      />,
    );

    await screen.findByRole('heading', { name: 'Polishing...' });
  });

  it('cancels active dictation from the overlay button', async () => {
    const cancelCapture = vi.fn<() => Promise<void>>(async () => {});
    render(
      <OverlayApp client={createClient(baseState, { cancelCapture })} soundsEnabled={false} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel dictation' }));

    expect(cancelCapture).toHaveBeenCalledOnce();
  });
});
