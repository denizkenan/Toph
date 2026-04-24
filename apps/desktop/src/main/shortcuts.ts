import {
  DEFAULT_SHORTCUT_PRESET,
  SHORTCUT_PRESETS,
  type ShortcutPreset,
  type ShortcutPresetId,
} from '@toph/desktop-contracts';

import type { PlatformAdapter } from './platform';
import type { ShortcutStateSupport, DesktopStateStore } from './state';

export interface ShortcutController {
  applyPreset: (presetId: ShortcutPresetId) => Promise<void>;
  unregister: () => void;
}

function resolveShortcutPreset(presetId: ShortcutPresetId) {
  return SHORTCUT_PRESETS.find((preset) => preset.id === presetId) ?? DEFAULT_SHORTCUT_PRESET;
}

function toUnexpectedFailureSupport(
  preset: ShortcutPreset,
  currentSupport: ShortcutStateSupport,
  error: unknown,
): ShortcutStateSupport {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return {
    backend: currentSupport.backend,
    registered: false,
    installable: currentSupport.installable,
    installed: false,
    detail: `Failed to apply ${preset.label}. ${detail}.`,
  };
}

export function createShortcutController(options: {
  stateStore: DesktopStateStore;
  platformAdapter: Pick<PlatformAdapter, 'registerShortcut' | 'unregisterShortcut'>;
  onTrigger: () => void;
}): ShortcutController {
  return {
    async applyPreset(presetId) {
      const preset = resolveShortcutPreset(presetId);

      try {
        const support = await options.platformAdapter.registerShortcut({
          preset,
          onTrigger: options.onTrigger,
        });
        options.stateStore.setShortcut(preset, support);
      } catch (error) {
        options.stateStore.setShortcut(
          preset,
          toUnexpectedFailureSupport(preset, options.stateStore.getState().shortcut, error),
        );
      }
    },

    unregister() {
      options.platformAdapter.unregisterShortcut();
    },
  };
}
