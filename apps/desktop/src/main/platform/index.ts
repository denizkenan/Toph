import { globalShortcut } from 'electron';

import type {
  PasteAttempt,
  PasteSupport,
  ShortcutBackend,
  ShortcutPreset,
} from '@toph/desktop-contracts';

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
  registerShortcut: (options: { preset: ShortcutPreset; onTrigger: () => void }) => Promise<ShortcutSupport>;
  unregisterShortcut: () => void;
}

export interface PlatformAdapterConfig {
  launcherScriptPath: string;
  toggleCaptureFlag: string;
}

export function createPlatformAdapter(config: PlatformAdapterConfig): PlatformAdapter {
  if (process.platform === 'linux') {
    return createLinuxPlatformAdapter(config);
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
    async registerShortcut({ preset, onTrigger }) {
      globalShortcut.unregisterAll();
      const registered = globalShortcut.register(preset.accelerator, onTrigger);

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
