import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, shell } from 'electron';

import { DEFAULT_APP_SETTINGS } from '@toph/desktop-contracts';

import macAppIconPath from '../../../../assets/app-icons/icon-mac.png?asset';
import appIconPath from '../../../../assets/app-icons/icon.png?asset';
import { createProviderAuthService } from './auth/provider-auth-service';
import type { PolishPrompt } from './db/schema';
import { createDictationController } from './dictation';
import { createOpenAiSubInferenceProvider } from './inference/providers/openai-sub-inference-provider';
import { registerDesktopIpc } from './ipc';
import { createElectronCaptureAudioRecorder } from './managers/audio-recorder';
import { createClipboardManager } from './managers/clipboard';
import { createPermissionManager } from './managers/permissions';
import { createShortcutManager } from './managers/shortcuts';
import { createWindowManager } from './managers/windows';
import { createSessionOutputService } from './outputs/session-output-service';
import { resolveTophDataPaths } from './paths';
import { defaultPolishPrompt } from './polish/builtin-prompts';
import { createPolishService } from './polish/polish-service';
import { createSessionSegmentationService } from './segmentation/session-segmentation-service';
import { createAppSettingsStore } from './settings/app-settings-store';
import { createDesktopStateStore } from './state';
import { createRecordingSessionStore } from './stores/session-store';
import { createOpenAiSubTranscriptionProvider } from './transcription/providers/openai-sub-transcription-provider';
import { createSessionTranscriptionCoordinator } from './transcription/session-transcription-coordinator';
import { createDesktopTrayController } from './tray';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appName = 'Toph';

function describeUnexpectedError(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${prefix} ${detail}.`;
}

function toPolishState(prompts: PolishPrompt[]) {
  return {
    prompts: prompts.map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      bodyHash: prompt.bodyHash,
      isBuiltin: prompt.isBuiltin,
    })),
  };
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
    appIconPath,
    isQuitting: () => isQuitting,
  });
  const permissions = createPermissionManager();
  const clipboard = createClipboardManager();

  await app.whenReady();

  if (process.platform === 'darwin') {
    app.dock?.setIcon(macAppIconPath);
  }

  const dataPaths = await resolveTophDataPaths();
  const sessionStore = await createRecordingSessionStore({
    paths: dataPaths,
    migrationsFolder: join(__dirname, '../../drizzle'),
  });
  await sessionStore.syncBuiltinPolishPrompt(defaultPolishPrompt);
  const legacyPolishSettings = await sessionStore.getLegacyPolishSettings();
  const settingsStore = await createAppSettingsStore({
    settingsPath: dataPaths.settingsPath,
    listPromptIds: async () => (await sessionStore.listPolishPrompts()).map((prompt) => prompt.id),
    defaultSettings: legacyPolishSettings
      ? {
          ...DEFAULT_APP_SETTINGS,
          polish: {
            enabled: legacyPolishSettings.enabled,
            promptId: legacyPolishSettings.activePromptId,
          },
        }
      : DEFAULT_APP_SETTINGS,
  });
  const refreshPolishState = async () => {
    stateStore.setPolish(toPolishState(await sessionStore.listPolishPrompts()));
  };
  const publishSettings = async () => {
    stateStore.setSettings(settingsStore.getSettings());
    await refreshPolishState();
  };
  const unsubscribeSettings = settingsStore.subscribe(() => {
    void publishSettings();
  });
  stateStore.setSettings(settingsStore.getSettings());
  await refreshPolishState();
  stateStore.setRecentConversions(
    (await sessionStore.listRecentSelectedSessionOutputs(8)).map((output) => ({
      id: output.id,
      text: output.text,
      kind: output.kind,
      promptId: output.promptId,
      promptHash: output.promptHash,
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
  const transcriptionProvider = createOpenAiSubTranscriptionProvider({
    auth: providerAuth,
    settingsStore,
  });
  const inferenceProvider = createOpenAiSubInferenceProvider({ auth: providerAuth, settingsStore });
  const transcription = createSessionTranscriptionCoordinator({
    sessionStore,
    provider: transcriptionProvider,
  });
  const polish = createPolishService({
    settingsStore,
    sessionStore,
    outputs,
    inference: inferenceProvider,
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
    polish,
    settingsStore,
    audioRecorder,
    clipboard,
    ensurePermissionsReady: async () =>
      (await ensureProvidersReady()) && (await ensurePermissionsReady()),
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
    cancelCapture: dictation.cancelCapture,
    resizeOverlay: windows.resizeOverlay,
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
    setAuthProvider: async (providerId) => {
      if (stateStore.getState().phase !== 'idle')
        throw new Error('Settings cannot be changed while dictation is active.');
      await settingsStore.setAuthProvider(providerId);
    },
    setTranscriptionProvider: async (providerId) => {
      if (stateStore.getState().phase !== 'idle')
        throw new Error('Settings cannot be changed while dictation is active.');
      await settingsStore.setTranscriptionProvider(providerId);
    },
    setTranscriptionModel: async (model) => {
      if (stateStore.getState().phase !== 'idle')
        throw new Error('Settings cannot be changed while dictation is active.');
      await settingsStore.setTranscriptionModel(model);
    },
    setInferenceProvider: async (providerId) => {
      if (stateStore.getState().phase !== 'idle')
        throw new Error('Settings cannot be changed while dictation is active.');
      await settingsStore.setInferenceProvider(providerId);
    },
    setInferenceModel: async (model) => {
      if (stateStore.getState().phase !== 'idle')
        throw new Error('Settings cannot be changed while dictation is active.');
      await settingsStore.setInferenceModel(model);
    },
    setPolishEnabled: async (enabled) => {
      if (stateStore.getState().phase !== 'idle')
        throw new Error('Settings cannot be changed while dictation is active.');
      await settingsStore.setPolishEnabled(enabled);
    },
    setActivePolishPrompt: async (promptId) => {
      if (stateStore.getState().phase !== 'idle')
        throw new Error('Settings cannot be changed while dictation is active.');
      await settingsStore.setPolishPrompt(promptId);
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
    unsubscribeSettings();
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
