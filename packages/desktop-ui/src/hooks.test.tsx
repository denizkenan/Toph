import { act, renderHook } from '@testing-library/react';

import type { AppState, DesktopApi } from '@toph/desktop-contracts';

import { useDesktopState } from './hooks';

const baseState: AppState = {
  phase: 'idle',
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
    status: 'idle',
    detail: 'No transcript has been pasted yet.',
  },
  lastTranscript: null,
  recentConversions: [],
  updatedAt: 1,
};

function createClient(onSubscribe: (listener: (state: AppState) => void) => () => void): DesktopApi {
  return {
    subscribeState: onSubscribe,
    toggleCapture: async () => {},
    showSettings: async () => {},
    hideSettings: async () => {},
    installShortcut: async () => {},
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
