import { contextBridge, ipcRenderer } from 'electron';

import type {
  AppState,
  DesktopApi,
  ShortcutPresetId,
  SoundEventKind,
} from '@toph/desktop-contracts';

const api: DesktopApi = {
  getState: () => ipcRenderer.invoke('toph:get-state') as Promise<AppState>,
  toggleCapture: () => ipcRenderer.invoke('toph:toggle-capture') as Promise<void>,
  showSettings: () => ipcRenderer.invoke('toph:show-settings') as Promise<void>,
  hideSettings: () => ipcRenderer.invoke('toph:hide-settings') as Promise<void>,
  installShortcut: (presetId: ShortcutPresetId) =>
    ipcRenderer.invoke('toph:install-shortcut', presetId) as Promise<void>,
  quit: () => ipcRenderer.invoke('toph:quit') as Promise<void>,
  onStateChange(listener) {
    const subscription = (_event: Electron.IpcRendererEvent, state: AppState) => {
      listener(state);
    };

    ipcRenderer.on('toph:state-changed', subscription);
    return () => {
      ipcRenderer.removeListener('toph:state-changed', subscription);
    };
  },
  onSoundEvent(listener) {
    const subscription = (_event: Electron.IpcRendererEvent, kind: SoundEventKind) => {
      listener(kind);
    };

    ipcRenderer.on('toph:sound', subscription);
    return () => {
      ipcRenderer.removeListener('toph:sound', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('toph', api);
