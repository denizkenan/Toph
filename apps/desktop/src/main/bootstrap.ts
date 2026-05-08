import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, shell } from 'electron';

import { createProviderAuthService } from './auth/provider-auth-service';
import { createDictationController } from './dictation';
import { registerDesktopIpc } from './ipc';
import { createElectronCaptureAudioRecorder } from './managers/audio-recorder';
import { createClipboardManager } from './managers/clipboard';
import { createPermissionManager } from './managers/permissions';
import { createShortcutManager } from './managers/shortcuts';
import { createWindowManager } from './managers/windows';
import { createSessionOutputService } from './outputs/session-output-service';
import { resolveTophDataPaths } from './paths';
import { createSessionSegmentationService } from './segmentation/session-segmentation-service';
import { createDesktopStateStore } from './state';
import { createRecordingSessionStore } from './stores/session-store';
import { createDesktopTrayController } from './tray';
import { createOpenAiSubTranscriptionProvider } from './transcription/providers/openai-sub-transcription-provider';
import { createSessionTranscriptionCoordinator } from './transcription/session-transcription-coordinator';

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
  stateStore.setRecentConversions(
    (await sessionStore.listRecentSelectedSessionOutputs(8)).map((output) => ({
      id: output.id,
      text: output.text,
      createdAt: output.createdAt,
      pasteStatus: 'idle',
      pasteDetail: 'Loaded from local history.',
    })),
  );
  const audioRecorder = createElectronCaptureAudioRecorder();
  const segmentation = createSessionSegmentationService({ sessionStore });
  const outputs = createSessionOutputService({ sessionStore });
  const providerAuth = createProviderAuthService({
    authPath: dataPaths.authPath,
    openExternal: shell.openExternal,
    onStateChanged: stateStore.setProviders,
  });
  stateStore.setProviders(await providerAuth.getState());
  const transcriptionProvider = createOpenAiSubTranscriptionProvider({ auth: providerAuth });
  const transcription = createSessionTranscriptionCoordinator({
    sessionStore,
    provider: transcriptionProvider,
  });

  const ensurePermissionsReady = async () => {
    const permissionState = await permissions.inspectRequiredPermissions();
    stateStore.setPermissions(permissionState);
    if (!permissionState.ready) {
      windows.showSettings();
    }
    return permissionState.ready;
  };
  const ensureProvidersReady = async () => {
    const providerState = await providerAuth.getState();
    stateStore.setProviders(providerState);
    if (!providerState.ready) {
      windows.showSettings();
    }
    return providerState.ready;
  };
  const dictation = createDictationController({
    stateStore,
    sessionStore,
    segmentation,
    transcription,
    outputs,
    audioRecorder,
    ensurePermissionsReady: async () => (await ensureProvidersReady()) && (await ensurePermissionsReady()),
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
    connectProvider: async (providerId) => {
      stateStore.setProviders(await providerAuth.getState());
      try {
        stateStore.setProviders(await providerAuth.connectProvider(providerId));
      } finally {
        stateStore.setProviders(await providerAuth.getState());
      }
    },
    submitProviderAuthorization: async (providerId, input) => {
      try {
        stateStore.setProviders(await providerAuth.submitProviderAuthorization(providerId, input));
      } finally {
        stateStore.setProviders(await providerAuth.getState());
      }
    },
    removeProvider: async (providerId) => {
      stateStore.setProviders(await providerAuth.removeProvider(providerId));
    },
    refreshProviders: async () => {
      stateStore.setProviders(await providerAuth.refreshProviders());
    },
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
  await ensureProvidersReady();
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

    void dictation.dispose().finally(async () => {
      await transcription.dispose();
      await providerAuth.dispose();
      sessionStore.close();
      quitCleanupComplete = true;
      app.quit();
    });
  });
}
