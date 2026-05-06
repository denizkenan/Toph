import { render, screen } from '@testing-library/react';

import type { AppState, DesktopApi } from '@toph/desktop-contracts';

import { OverlayApp } from './overlay-app';

const baseState: AppState = {
  phase: 'transcribing',
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
    performPermissionAction: async () => {},
    refreshPermissions: async () => {},
    onSoundEvent: () => () => {},
    quit: async () => {},
  };
}

describe('OverlayApp', () => {
  it('renders the idle ready indicator', async () => {
    render(<OverlayApp client={createClient({ ...baseState, phase: 'idle' })} soundsEnabled={false} />);

    await screen.findByLabelText('Toph ready');
  });

  it('renders the processing state without Electron globals', async () => {
    render(<OverlayApp client={createClient(baseState)} soundsEnabled={false} />);

    await screen.findByRole('heading', { name: 'Processing...' });
  });
});
