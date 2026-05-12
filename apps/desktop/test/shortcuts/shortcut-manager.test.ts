import assert from 'node:assert/strict';
import test from 'node:test';

import { shortcutChordToElectronAccelerator, type AppState, type ShortcutChord } from '@toph/desktop-contracts';

import { createShortcutManagerCore } from '../../src/main/managers/shortcut-manager-core.ts';
import type { DesktopStateStore, ShortcutStateSupport } from '../../src/main/state.ts';

const defaultChord: ShortcutChord = { modifiers: ['control', 'alt'], key: 'Space' };
const alternateChord: ShortcutChord = { modifiers: ['control', 'alt'], key: 'X' };
const thirdChord: ShortcutChord = { modifiers: ['control', 'shift'], key: 'K' };

function createStateStore(chord: ShortcutChord = defaultChord) {
  const state = {
    shortcut: {
      chord,
      backend: 'electron-global-shortcut',
      registered: true,
      installable: true,
      installed: true,
      detail: 'Registered.',
    },
  } as AppState;

  const store: Pick<DesktopStateStore, 'getState' | 'setShortcut'> = {
    getState() {
      return state;
    },
    setShortcut(nextChord: ShortcutChord, support: ShortcutStateSupport) {
      state.shortcut = {
        ...state.shortcut,
        chord: nextChord,
        ...support,
      };
    },
  };

  return store as DesktopStateStore;
}

function createShortcutApi(registerResults: boolean[] = [true]) {
  const registrations: string[] = [];
  let unregisters = 0;

  return {
    registerShortcut(chord: ShortcutChord) {
      const accelerator = shortcutChordToElectronAccelerator(chord, 'linux');
      unregisters += 1;
      registrations.push(accelerator);
      const registered = registerResults.shift() ?? true;
      return Promise.resolve({
        backend: 'electron-global-shortcut' as const,
        registered,
        installable: true,
        installed: registered,
        detail: registered ? 'Registered.' : 'Registration failed.',
      });
    },
    suspendShortcut() {
      unregisters += 1;
      return Promise.resolve();
    },
    unregisterShortcut() {
      unregisters += 1;
    },
    getRegistrations: () => registrations,
    getUnregisters: () => unregisters,
  };
}

test('installs and persists a custom shortcut after successful registration', async () => {
  const stateStore = createStateStore();
  const shortcutApi = createShortcutApi([true]);
  const persisted: ShortcutChord[] = [];
  const manager = createShortcutManagerCore({
    stateStore,
    registerShortcut: shortcutApi.registerShortcut,
    suspendShortcut: shortcutApi.suspendShortcut,
    unregisterShortcut: shortcutApi.unregisterShortcut,
    persistShortcut: async (chord) => {
      persisted.push(chord);
    },
  });

  await manager.installShortcut(alternateChord);

  assert.deepEqual(stateStore.getState().shortcut.chord, alternateChord);
  assert.deepEqual(persisted, [alternateChord]);
  assert.deepEqual(shortcutApi.getRegistrations(), ['Control+Alt+X']);
});

test('restores the previous shortcut and skips persistence when registration fails', async () => {
  const stateStore = createStateStore();
  const shortcutApi = createShortcutApi([false, true]);
  const persisted: ShortcutChord[] = [];
  const manager = createShortcutManagerCore({
    stateStore,
    registerShortcut: shortcutApi.registerShortcut,
    suspendShortcut: shortcutApi.suspendShortcut,
    unregisterShortcut: shortcutApi.unregisterShortcut,
    persistShortcut: async (chord) => {
      persisted.push(chord);
    },
  });

  await assert.rejects(() => manager.installShortcut(alternateChord));

  assert.deepEqual(stateStore.getState().shortcut.chord, defaultChord);
  assert.deepEqual(persisted, []);
  assert.deepEqual(shortcutApi.getRegistrations(), ['Control+Alt+X', 'Control+Alt+Space']);
});

test('suspend unregisters the active shortcut and resume registers it again', async () => {
  const stateStore = createStateStore();
  const shortcutApi = createShortcutApi([true]);
  const manager = createShortcutManagerCore({
    stateStore,
    registerShortcut: shortcutApi.registerShortcut,
    suspendShortcut: shortcutApi.suspendShortcut,
    unregisterShortcut: shortcutApi.unregisterShortcut,
    persistShortcut: async () => {},
  });

  await manager.suspend();
  await manager.resume();

  assert.equal(shortcutApi.getUnregisters(), 2);
  assert.deepEqual(shortcutApi.getRegistrations(), ['Control+Alt+Space']);
});

test('queues installs so later shortcut requests win in order', async () => {
  const stateStore = createStateStore();
  const shortcutApi = createShortcutApi([true, true]);
  const persisted: ShortcutChord[] = [];
  let releaseFirstPersist: (() => void) | null = null;
  const firstPersist = new Promise<void>((resolve) => {
    releaseFirstPersist = resolve;
  });
  const manager = createShortcutManagerCore({
    stateStore,
    registerShortcut: shortcutApi.registerShortcut,
    suspendShortcut: shortcutApi.suspendShortcut,
    unregisterShortcut: shortcutApi.unregisterShortcut,
    persistShortcut: async (chord) => {
      persisted.push(chord);
      if (persisted.length === 1) {
        await firstPersist;
      }
    },
  });

  const firstInstall = manager.installShortcut(alternateChord);
  const secondInstall = manager.installShortcut(thirdChord);
  releaseFirstPersist?.();
  await Promise.all([firstInstall, secondInstall]);

  assert.deepEqual(persisted, [alternateChord, thirdChord]);
  assert.deepEqual(stateStore.getState().shortcut.chord, thirdChord);
  assert.deepEqual(shortcutApi.getRegistrations(), ['Control+Alt+X', 'Control+Shift+K']);
});
