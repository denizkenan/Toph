import { formatShortcutChord, type ShortcutChord } from '@toph/desktop-contracts';

import type { DesktopStateStore, ShortcutStateSupport } from '../state';

export interface ShortcutManager {
  installShortcut: (chord: ShortcutChord) => Promise<void>;
  registerSavedShortcut: (chord: ShortcutChord) => Promise<void>;
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  unregister: () => void;
}

function toUnexpectedFailureSupport(
  chord: ShortcutChord,
  currentSupport: ShortcutStateSupport,
  error: unknown,
): ShortcutStateSupport {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return {
    backend: currentSupport.backend,
    registered: false,
    installable: currentSupport.installable,
    installed: false,
    detail: `Failed to apply ${formatShortcutChord(chord, process.platform)}. ${detail}.`,
  };
}

export function createShortcutManagerCore(options: {
  stateStore: DesktopStateStore;
  registerShortcut: (chord: ShortcutChord) => Promise<ShortcutStateSupport>;
  suspendShortcut: () => Promise<void>;
  unregisterShortcut: () => void;
  persistShortcut: (chord: ShortcutChord) => Promise<void>;
}): ShortcutManager {
  let shortcutQueue: Promise<void> = Promise.resolve();
  let suspended = false;

  const enqueueShortcutOperation = (operation: () => Promise<void>) => {
    const task = shortcutQueue.then(operation);
    shortcutQueue = task.catch(() => {});
    return task;
  };

  const restorePreviousShortcut = async (previousChord: ShortcutChord) => {
    try {
      const support = await options.registerShortcut(previousChord);
      options.stateStore.setShortcut(previousChord, support);
    } catch (error) {
      options.stateStore.setShortcut(
        previousChord,
        toUnexpectedFailureSupport(previousChord, options.stateStore.getState().shortcut, error),
      );
    }
  };

  const installShortcutNow = async (chord: ShortcutChord) => {
    const previousChord = options.stateStore.getState().shortcut.chord;
    let restoredPrevious = false;
    suspended = false;

    try {
      const support = await options.registerShortcut(chord);
      if (!support.registered) {
        await restorePreviousShortcut(previousChord);
        restoredPrevious = true;
        throw new Error(support.detail);
      }

      try {
        await options.persistShortcut(chord);
      } catch (error) {
        await restorePreviousShortcut(previousChord);
        restoredPrevious = true;
        throw error;
      }

      options.stateStore.setShortcut(chord, support);
    } catch (error) {
      if (!restoredPrevious) {
        await restorePreviousShortcut(previousChord);
      }
      const detail = error instanceof Error ? error.message : 'Unknown shortcut registration failure.';
      throw new Error(detail, { cause: error });
    }
  };

  const registerSavedShortcutNow = async (chord: ShortcutChord) => {
    suspended = false;
    try {
      const support = await options.registerShortcut(chord);
      options.stateStore.setShortcut(chord, support);
    } catch (error) {
      options.stateStore.setShortcut(
        chord,
        toUnexpectedFailureSupport(chord, options.stateStore.getState().shortcut, error),
      );
    }
  };

  return {
    installShortcut(chord) {
      return enqueueShortcutOperation(() => installShortcutNow(chord));
    },

    registerSavedShortcut(chord) {
      return enqueueShortcutOperation(() => registerSavedShortcutNow(chord));
    },

    suspend() {
      return enqueueShortcutOperation(async () => {
        suspended = true;
        await options.suspendShortcut();
      });
    },

    resume() {
      return enqueueShortcutOperation(async () => {
        if (!suspended) {
          return;
        }

        await registerSavedShortcutNow(options.stateStore.getState().shortcut.chord);
      });
    },

    unregister() {
      options.unregisterShortcut();
    },
  };
}
