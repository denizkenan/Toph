import { globalShortcut } from 'electron';

import type { PasteAttempt, PasteSupport, ShortcutBackend } from '@toph/desktop-contracts';

import { createLinuxPlatformAdapter } from './linux';

export interface ShortcutSupport {
  backend: ShortcutBackend;
  registered: boolean;
  installable: boolean;
  installed: boolean;
  detail: string;
}

export interface PlatformAdapter {
  describePasteSupport: () => Promise<PasteSupport>;
  pasteFromClipboard: () => Promise<PasteAttempt>;
  registerShortcut: (options: {
    accelerator: string;
    command: string | null;
    binding: string;
    label: string;
    onTrigger: () => void;
  }) => Promise<ShortcutSupport>;
  unregisterShortcut: () => void;
}

export function createPlatformAdapter(): PlatformAdapter {
  if (process.platform === 'linux') {
    return createLinuxPlatformAdapter();
  }

  return {
    async describePasteSupport() {
      return {
        helper: null,
        detail: 'Clipboard write is ready. Auto-paste is not implemented for this platform yet.',
      };
    },
    async pasteFromClipboard() {
      return {
        helper: null,
        status: 'clipboard-only',
        detail:
          'Transcript copied to clipboard. Auto-paste is not implemented for this platform yet.',
      };
    },
    async registerShortcut({ accelerator, onTrigger }) {
      globalShortcut.unregisterAll();
      const registered = globalShortcut.register(accelerator, onTrigger);

      return {
        backend: 'electron-global-shortcut',
        registered,
        installable: true,
        installed: registered,
        detail: registered
          ? 'Electron global shortcut registration is active.'
          : 'Electron global shortcut registration is unavailable right now.',
      };
    },

    unregisterShortcut() {
      globalShortcut.unregisterAll();
    },
  };
}
