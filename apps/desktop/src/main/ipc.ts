import { ipcMain } from 'electron';

import {
  DESKTOP_IPC_CHANNELS,
  isShortcutChord,
  PERMISSION_REQUIREMENT_IDS,
  PROVIDER_IDS,
  validateShortcutChord,
  type AppState,
  type OverlaySize,
  type PermissionRequirementId,
  type ProviderId,
  type ShortcutChord,
} from '@toph/desktop-contracts';

function isPermissionRequirementId(value: unknown): value is PermissionRequirementId {
  return (
    typeof value === 'string' &&
    PERMISSION_REQUIREMENT_IDS.includes(value as PermissionRequirementId)
  );
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && PROVIDER_IDS.includes(value as ProviderId);
}

export function registerDesktopIpc(options: {
  getState: () => AppState;
  toggleCapture: () => Promise<void>;
  cancelCapture: () => Promise<void>;
  resizeOverlay: (size: OverlaySize) => void;
  showSettings: () => void;
  hideSettings: () => void;
  installShortcut: (chord: ShortcutChord) => Promise<void>;
  suspendShortcut: () => Promise<void>;
  resumeShortcut: () => Promise<void>;
  connectProvider: (providerId: ProviderId) => Promise<void>;
  submitProviderAuthorization: (providerId: ProviderId, input: string) => Promise<void>;
  removeProvider: (providerId: ProviderId) => Promise<void>;
  refreshProviders: () => Promise<void>;
  setAuthProvider: (providerId: ProviderId) => Promise<void>;
  setTranscriptionProvider: (providerId: ProviderId) => Promise<void>;
  setTranscriptionModel: (model: string) => Promise<void>;
  setInferenceProvider: (providerId: ProviderId) => Promise<void>;
  setInferenceModel: (model: string) => Promise<void>;
  setPolishEnabled: (enabled: boolean) => Promise<void>;
  setActivePolishPrompt: (promptId: string) => Promise<void>;
  performPermissionAction: (permissionId: PermissionRequirementId) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  quit: () => void;
}) {
  ipcMain.handle(DESKTOP_IPC_CHANNELS.subscribeState, (event) => {
    event.sender.send(DESKTOP_IPC_CHANNELS.state, options.getState());
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.toggleCapture, async () => {
    await options.toggleCapture();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.cancelCapture, async () => {
    await options.cancelCapture();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.resizeOverlay, async (_event, size: unknown) => {
    if (
      typeof size !== 'object' ||
      size === null ||
      !Number.isFinite((size as OverlaySize).width) ||
      !Number.isFinite((size as OverlaySize).height)
    ) {
      throw new Error('Invalid overlay size.');
    }

    options.resizeOverlay(size as OverlaySize);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.showSettings, async () => {
    options.showSettings();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.hideSettings, async () => {
    options.hideSettings();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.installShortcut, async (_event, chord: unknown) => {
    if (!isShortcutChord(chord)) {
      throw new Error('Invalid shortcut.');
    }

    const validation = validateShortcutChord(chord);
    if (!validation.valid) {
      throw new Error('Invalid shortcut.');
    }

    await options.installShortcut(validation.chord);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.suspendShortcut, async () => {
    await options.suspendShortcut();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.resumeShortcut, async () => {
    await options.resumeShortcut();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.connectProvider, async (_event, providerId: unknown) => {
    if (!isProviderId(providerId)) {
      throw new Error('Unknown provider.');
    }

    await options.connectProvider(providerId);
  });
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.submitProviderAuthorization,
    async (_event, providerId: unknown, input: unknown) => {
      if (!isProviderId(providerId) || typeof input !== 'string') {
        throw new Error('Unknown provider authorization request.');
      }

      await options.submitProviderAuthorization(providerId, input);
    },
  );
  ipcMain.handle(DESKTOP_IPC_CHANNELS.removeProvider, async (_event, providerId: unknown) => {
    if (!isProviderId(providerId)) {
      throw new Error('Unknown provider.');
    }

    await options.removeProvider(providerId);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.refreshProviders, async () => {
    await options.refreshProviders();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.setAuthProvider, async (_event, providerId: unknown) => {
    if (!isProviderId(providerId)) {
      throw new Error('Unknown auth provider.');
    }
    await options.setAuthProvider(providerId);
  });
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setTranscriptionProvider,
    async (_event, providerId: unknown) => {
      if (!isProviderId(providerId)) {
        throw new Error('Unknown transcription provider.');
      }
      await options.setTranscriptionProvider(providerId);
    },
  );
  ipcMain.handle(DESKTOP_IPC_CHANNELS.setTranscriptionModel, async (_event, model: unknown) => {
    if (typeof model !== 'string') {
      throw new Error('Invalid transcription model.');
    }
    await options.setTranscriptionModel(model);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.setInferenceProvider, async (_event, providerId: unknown) => {
    if (!isProviderId(providerId)) {
      throw new Error('Unknown inference provider.');
    }
    await options.setInferenceProvider(providerId);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.setInferenceModel, async (_event, model: unknown) => {
    if (typeof model !== 'string') {
      throw new Error('Invalid inference model.');
    }
    await options.setInferenceModel(model);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.setPolishEnabled, async (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('Invalid Polish enabled setting.');
    }

    await options.setPolishEnabled(enabled);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.setActivePolishPrompt, async (_event, promptId: unknown) => {
    if (typeof promptId !== 'string' || promptId.trim().length === 0) {
      throw new Error('Invalid Polish prompt.');
    }

    await options.setActivePolishPrompt(promptId);
  });
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.performPermissionAction,
    async (_event, permissionId: unknown) => {
      if (!isPermissionRequirementId(permissionId)) {
        throw new Error('Unknown permission action.');
      }

      await options.performPermissionAction(permissionId);
    },
  );
  ipcMain.handle(DESKTOP_IPC_CHANNELS.refreshPermissions, async () => {
    await options.refreshPermissions();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.quit, async () => {
    options.quit();
  });

  return () => {
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.subscribeState);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.toggleCapture);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.cancelCapture);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.resizeOverlay);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.showSettings);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.hideSettings);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.installShortcut);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.suspendShortcut);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.resumeShortcut);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.connectProvider);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.submitProviderAuthorization);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.removeProvider);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.refreshProviders);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.setAuthProvider);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.setTranscriptionProvider);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.setTranscriptionModel);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.setInferenceProvider);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.setInferenceModel);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.setPolishEnabled);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.setActivePolishPrompt);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.performPermissionAction);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.refreshPermissions);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.quit);
  };
}
