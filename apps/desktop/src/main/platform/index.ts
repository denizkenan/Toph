import { globalShortcut } from 'electron';

import type {
  PasteAttempt,
  PasteSupport,
  ShortcutBackend,
  ShortcutPreset,
} from '@toph/desktop-contracts';

import { createLinuxPlatformAdapter } from './linux';

function describeShortcutRegistrationFailure(preset: ShortcutPreset) {
  if (process.platform === 'darwin') {
    return `${preset.label} could not be registered. macOS may reserve this shortcut for input source switching. Check System Settings > Keyboard > Keyboard Shortcuts > Input Sources, then try again.`;
  }

  return 'Electron global shortcut registration is unavailable right now.';
}

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

      if (!registered && process.platform === 'darwin') {
        console.warn('[Toph] macOS global shortcut registration failed.', {
          accelerator: preset.accelerator,
          label: preset.label,
          presetId: preset.id,
        });
      }

      return {
        backend: 'electron-global-shortcut',
        registered,
        installable: true,
        installed: registered,
        detail: registered
          ? 'Electron global shortcut registration is active.'
          : describeShortcutRegistrationFailure(preset),
      };
    },

    unregisterShortcut() {
      globalShortcut.unregisterAll();
    },
  };
}
