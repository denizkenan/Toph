import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app } from 'electron';

import { createDictationController } from './dictation';
import { registerDesktopIpc } from './ipc';
import { createElectronCaptureAudioRecorder } from './managers/audio-recorder';
import { createClipboardManager } from './managers/clipboard';
import { createPermissionManager } from './managers/permissions';
import { createShortcutManager } from './managers/shortcuts';
import { createWindowManager } from './managers/windows';
import { resolveTophDataPaths } from './paths';
import { createDesktopStateStore } from './state';
import { createRecordingSessionStore } from './stores/session-store';
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

  await app.whenReady();

  const dataPaths = await resolveTophDataPaths(app);
  const sessionStore = await createRecordingSessionStore({
    paths: dataPaths,
    migrationsFolder: join(__dirname, '../../drizzle'),
  });
  const audioRecorder = createElectronCaptureAudioRecorder();

  const ensurePermissionsReady = async () => {
    const permissionState = await permissions.inspectRequiredPermissions();
    stateStore.setPermissions(permissionState);
    if (!permissionState.ready) {
      windows.showSettings();
    }
    return permissionState.ready;
  };
  const dictation = createDictationController({
    stateStore,
    sessionStore,
    audioRecorder,
    ensurePermissionsReady,
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
    performPermissionAction: async (permissionId) => {
      stateStore.setPermissions(await permissions.performPermissionAction(permissionId));
    },
    refreshPermissions: async () => {
      await ensurePermissionsReady();
    },
    quit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  await windows.create();
  await ensurePermissionsReady();
  const stopTrackingOverlayPlacement = windows.trackOverlayPlacement();
  tray.create();
  let quitCleanupComplete = false;

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
  app.on('will-quit', (event) => {
    if (quitCleanupComplete) {
      return;
    }

    event.preventDefault();
    stopTrackingOverlayPlacement();
    unregisterIpc();
    unsubscribeState();
    shortcuts.unregister();

    void dictation.dispose().finally(() => {
      sessionStore.close();
      quitCleanupComplete = true;
      app.quit();
    });
  });
}
