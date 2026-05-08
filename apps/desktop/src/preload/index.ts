import { contextBridge, ipcRenderer } from 'electron';

import type {
  AppState,
  DesktopApi,
  PermissionRequirementId,
  ProviderId,
  ShortcutPresetId,
  SoundEventKind,
} from '@toph/desktop-contracts';
import { DESKTOP_IPC_CHANNELS } from '@toph/desktop-contracts';

const stateListeners = new Set<(state: AppState) => void>();
let lastKnownState: AppState | null = null;

const handleStateSnapshot = (_event: Electron.IpcRendererEvent, state: AppState) => {
  lastKnownState = state;

  for (const listener of stateListeners) {
    listener(state);
  }
};

const api: DesktopApi = {
  subscribeState(listener) {
    stateListeners.add(listener);

    if (stateListeners.size === 1) {
      ipcRenderer.on(DESKTOP_IPC_CHANNELS.state, handleStateSnapshot);
      void ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.subscribeState);
    } else if (lastKnownState) {
      listener(lastKnownState);
    }

    return () => {
      stateListeners.delete(listener);

      if (stateListeners.size === 0) {
        ipcRenderer.removeListener(DESKTOP_IPC_CHANNELS.state, handleStateSnapshot);
      }
    };
  },
  toggleCapture: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.toggleCapture) as Promise<void>,
  showSettings: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.showSettings) as Promise<void>,
  hideSettings: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.hideSettings) as Promise<void>,
  installShortcut: (presetId: ShortcutPresetId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.installShortcut, presetId) as Promise<void>,
  connectProvider: (providerId: ProviderId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.connectProvider, providerId) as Promise<void>,
  submitProviderAuthorization: (providerId: ProviderId, input: string) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.submitProviderAuthorization, providerId, input) as Promise<void>,
  removeProvider: (providerId: ProviderId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.removeProvider, providerId) as Promise<void>,
  refreshProviders: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.refreshProviders) as Promise<void>,
  performPermissionAction: (permissionId: PermissionRequirementId) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.performPermissionAction, permissionId) as Promise<void>,
  refreshPermissions: () =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.refreshPermissions) as Promise<void>,
  quit: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.quit) as Promise<void>,
  onSoundEvent(listener) {
    const subscription = (_event: Electron.IpcRendererEvent, kind: SoundEventKind) => {
      listener(kind);
    };

    ipcRenderer.on(DESKTOP_IPC_CHANNELS.sound, subscription);
    return () => {
      ipcRenderer.removeListener(DESKTOP_IPC_CHANNELS.sound, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('toph', api);
