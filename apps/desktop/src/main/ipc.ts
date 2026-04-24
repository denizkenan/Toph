import { ipcMain } from 'electron';

import type { ShortcutPresetId } from '@toph/desktop-contracts';

export function registerDesktopIpc(options: {
  getState: () => unknown;
  toggleCapture: () => Promise<void>;
  showSettings: () => void;
  hideSettings: () => void;
  installShortcut: (presetId: ShortcutPresetId) => Promise<void>;
  quit: () => void;
}) {
  ipcMain.handle('toph:get-state', async () => options.getState());
  ipcMain.handle('toph:toggle-capture', async () => {
    await options.toggleCapture();
  });
  ipcMain.handle('toph:show-settings', async () => {
    options.showSettings();
  });
  ipcMain.handle('toph:hide-settings', async () => {
    options.hideSettings();
  });
  ipcMain.handle('toph:install-shortcut', async (_event, presetId: ShortcutPresetId) => {
    await options.installShortcut(presetId);
  });
  ipcMain.handle('toph:quit', async () => {
    options.quit();
  });

  return () => {
    ipcMain.removeHandler('toph:get-state');
    ipcMain.removeHandler('toph:toggle-capture');
    ipcMain.removeHandler('toph:show-settings');
    ipcMain.removeHandler('toph:hide-settings');
    ipcMain.removeHandler('toph:install-shortcut');
    ipcMain.removeHandler('toph:quit');
  };
}
