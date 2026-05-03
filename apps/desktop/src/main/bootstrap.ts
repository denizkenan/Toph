import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app } from 'electron';

import { createDictationController } from './dictation';
import { registerDesktopIpc } from './ipc';
import { createClipboardManager } from './managers/clipboard';
import { createPermissionManager } from './managers/permissions';
import { createShortcutManager } from './managers/shortcuts';
import { createWindowManager } from './managers/windows';
import { createDesktopStateStore } from './state';
import { createDesktopTrayController } from './tray';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appName = 'Toph';

function describeUnexpectedError(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${prefix} ${detail}.`;
}

export async function bootstrap(options: {
  shouldToggleOnLaunch: boolean;
  toggleCaptureFlag: string;
}) {
  app.setName(appName);

  const singleInstance = app.requestSingleInstanceLock();
  if (!singleInstance) {
    app.quit();
    return;
  }

  let isQuitting = false;
  let pendingToggle = options.shouldToggleOnLaunch;

  const stateStore = createDesktopStateStore();
  const windows = createWindowManager({
    appName,
    isQuitting: () => isQuitting,
  });
  const permissions = createPermissionManager();
  const clipboard = createClipboardManager();
  const dictation = createDictationController({
    stateStore,
    clipboard,
    windows,
  });
  const shortcuts = createShortcutManager({
    stateStore,
    config: {
      launcherScriptPath: join(__dirname, '../../../../scripts/toph-desktop.sh'),
      toggleCaptureFlag: options.toggleCaptureFlag,
    },
    onTrigger: () => {
      void dictation.toggleCapture();
    },
  });
  const tray = createDesktopTrayController({
    appName,
    getState: stateStore.getState,
    showSettings: windows.showSettings,
    toggleCapture: dictation.toggleCapture,
    quit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  app.on('second-instance', (_event, argv) => {
    if (argv.includes(options.toggleCaptureFlag)) {
      if (!app.isReady()) {
        pendingToggle = true;
        return;
      }

      void dictation.toggleCapture();
      return;
    }

    if (!app.isReady()) {
      return;
    }

    windows.showSettings();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  await app.whenReady();

  const unsubscribeState = stateStore.subscribe((state) => {
    windows.sendState(state);
    tray.refresh();
  });
  const unregisterIpc = registerDesktopIpc({
    getState: stateStore.getState,
    toggleCapture: dictation.toggleCapture,
    showSettings: windows.showSettings,
    hideSettings: windows.hideSettings,
    installShortcut: shortcuts.applyPreset,
    quit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  await windows.create();
  await permissions.inspectRequiredPermissions();
  const stopTrackingDisplays = windows.trackDisplayChanges();
  tray.create();

  await shortcuts.applyPreset(stateStore.getState().shortcut.presetId);

  try {
    stateStore.setPasteSupport(await clipboard.describePasteSupport());
  } catch (error) {
    stateStore.setPasteSupport({
      helper: null,
      detail: describeUnexpectedError('Desktop paste capabilities could not be inspected.', error),
    });
  }

  if (pendingToggle) {
    pendingToggle = false;
    void dictation.toggleCapture();
  }

  app.on('activate', windows.showSettings);
  app.on('will-quit', () => {
    stopTrackingDisplays();
    unregisterIpc();
    unsubscribeState();
    dictation.dispose();
    shortcuts.unregister();
  });
}
