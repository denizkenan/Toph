import { render, screen } from '@testing-library/react';

import type { AppState, DesktopApi } from '@toph/desktop-contracts';

import { HomeApp } from './home-app';

const baseState: AppState = {
  phase: 'idle',
  shortcut: {
    presetId: 'toggle-dictation-primary',
    accelerator: 'CommandOrControl+Alt+Space',
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

function createClient(state: AppState): DesktopApi {
  return {
    subscribeState: (listener) => {
      listener(state);
      return () => {};
    },
    toggleCapture: async () => {},
    showSettings: async () => {},
    hideSettings: async () => {},
    installShortcut: async () => {},
    onSoundEvent: () => () => {},
    quit: async () => {},
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
          createdAt: Date.now() - 120_000,
          pasteStatus: 'success',
          pasteDetail: 'Pasted via ydotool.',
        },
        {
          id: 'conv-2',
          text: 'Another dictation that failed to paste.',
          createdAt: Date.now() - 600_000,
          pasteStatus: 'failed',
          pasteDetail: 'ydotool timed out.',
        },
      ],
    };

    render(<HomeApp client={createClient(stateWithConversions)} />);

    await screen.findByText('This is a test dictation result from the mock flow.');
    expect(screen.getByText('Pasted')).toBeTruthy();
    expect(screen.getByText('Paste failed')).toBeTruthy();
  });
});
