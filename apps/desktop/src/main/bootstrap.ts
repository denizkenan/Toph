import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app } from 'electron';

import { APP_NAME } from '@toph/desktop-contracts';

import { createDictationController } from './dictation';
import { registerDesktopIpc } from './ipc';
import { createPlatformAdapter } from './platform';
import { createShortcutController } from './shortcuts';
import { createDesktopStateStore } from './state';
import { createDesktopTrayController } from './tray';
import { createDesktopWindowManager } from './windows';

const __dirname = dirname(fileURLToPath(import.meta.url));

function describeUnexpectedError(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${prefix} ${detail}.`;
}

export async function bootstrap(options: {
  shouldToggleOnLaunch: boolean;
  toggleCaptureFlag: string;
}) {
  app.setName(APP_NAME);

  const singleInstance = app.requestSingleInstanceLock();
  if (!singleInstance) {
    app.quit();
    return;
  }

  let isQuitting = false;
  let pendingToggle = options.shouldToggleOnLaunch;

  const stateStore = createDesktopStateStore();
  const windows = createDesktopWindowManager({
    appName: APP_NAME,
    isQuitting: () => isQuitting,
  });
  const platformAdapter = createPlatformAdapter({
    launcherScriptPath: join(__dirname, '../../../../scripts/toph-desktop.sh'),
    toggleCaptureFlag: options.toggleCaptureFlag,
  });
  const dictation = createDictationController({
    stateStore,
    platformAdapter,
    windows,
  });
  const shortcuts = createShortcutController({
    stateStore,
    platformAdapter,
    onTrigger: () => {
      void dictation.toggleCapture();
    },
  });
  const tray = createDesktopTrayController({
    appName: APP_NAME,
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
  const stopTrackingDisplays = windows.trackDisplayChanges();
  tray.create();

  await shortcuts.applyPreset(stateStore.getState().shortcut.presetId);

  try {
    stateStore.setPasteSupport(await platformAdapter.describePasteSupport());
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
