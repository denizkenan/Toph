import { ipcMain } from 'electron';

import {
  DESKTOP_IPC_CHANNELS,
  type AppState,
  type ShortcutPresetId,
} from '@toph/desktop-contracts';

export function registerDesktopIpc(options: {
  getState: () => AppState;
  toggleCapture: () => Promise<void>;
  showSettings: () => void;
  hideSettings: () => void;
  installShortcut: (presetId: ShortcutPresetId) => Promise<void>;
  quit: () => void;
}) {
  ipcMain.handle(DESKTOP_IPC_CHANNELS.subscribeState, (event) => {
    event.sender.send(DESKTOP_IPC_CHANNELS.state, options.getState());
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.toggleCapture, async () => {
    await options.toggleCapture();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.showSettings, async () => {
    options.showSettings();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.hideSettings, async () => {
    options.hideSettings();
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.installShortcut, async (_event, presetId: ShortcutPresetId) => {
    await options.installShortcut(presetId);
  });
  ipcMain.handle(DESKTOP_IPC_CHANNELS.quit, async () => {
    options.quit();
  });

  return () => {
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.subscribeState);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.toggleCapture);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.showSettings);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.hideSettings);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.installShortcut);
    ipcMain.removeHandler(DESKTOP_IPC_CHANNELS.quit);
  };
}
