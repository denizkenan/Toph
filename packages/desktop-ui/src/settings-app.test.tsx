import { render, screen } from '@testing-library/react';

import type { AppState, DesktopApi } from '@toph/desktop-contracts';

import { SettingsApp } from './settings-app';

const baseState: AppState = {
  phase: 'listening',
  shortcut: {
    presetId: 'ctrl-alt-space',
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
    status: 'success',
    detail: 'Transcript copied to the clipboard and paste was attempted with ydotool.',
  },
  lastTranscript: 'hello',
  recentConversions: [],
  updatedAt: 1,
};

function createClient(state: AppState): DesktopApi {
  return {
    getState: async () => state,
    toggleCapture: async () => {},
    showSettings: async () => {},
    hideSettings: async () => {},
    installShortcut: async () => {},
    onStateChange: () => () => {},
    onSoundEvent: () => () => {},
    quit: async () => {},
  };
}

describe('SettingsApp', () => {
  it('renders state from the injected desktop client', async () => {
    render(<SettingsApp client={createClient(baseState)} />);

    await screen.findByRole('heading', { name: 'Toph' });
    await screen.findByText('Listening');

    expect(screen.getByRole('button', { name: 'Stop mock capture' })).toBeTruthy();
    expect(screen.getByText('GNOME')).toBeTruthy();
    expect(screen.getByText('Electron global shortcut registration is active.')).toBeTruthy();
  });
});
