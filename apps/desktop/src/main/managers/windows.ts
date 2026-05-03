import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BrowserWindow, screen } from 'electron';

import { DESKTOP_IPC_CHANNELS, type AppState, type SoundEventKind } from '@toph/desktop-contracts';

export interface WindowManager {
  create: () => Promise<void>;
  showSettings: () => void;
  hideSettings: () => void;
  showOverlay: () => void;
  hideOverlay: () => void;
  sendState: (state: AppState) => void;
  emitSound: (kind: SoundEventKind) => void;
  trackDisplayChanges: () => () => void;
}

const mainBundleDir = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(mainBundleDir, '../preload/index.mjs');

function getRendererPath(page: 'index.html' | 'overlay.html') {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${page}`;
  }

  return join(mainBundleDir, `../renderer/${page}`);
}

async function loadRendererPage(window: BrowserWindow, page: 'index.html' | 'overlay.html') {
  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(getRendererPath(page));
    return;
  }

  await window.loadFile(getRendererPath(page));
}

export function createWindowManager(options: {
  appName: string;
  isQuitting: () => boolean;
}): WindowManager {
  let settingsWindow: BrowserWindow | null = null;
  let overlayWindow: BrowserWindow | null = null;

  const keepOverlayOnCurrentSpace = () => {
    if (!overlayWindow) {
      return;
    }

    if (process.platform !== 'darwin') {
      overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      return;
    }

    // macOS fullscreen apps are separate Spaces. Re-applying this before every
    // show keeps the overlay detached from the Space where it was first shown.
    overlayWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
    overlayWindow.setHiddenInMissionControl(true);
  };

  const positionOverlay = () => {
    if (!overlayWindow) {
      return;
    }

    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const { workArea } = display;
    const bounds = overlayWindow.getBounds();
    const x = Math.round(workArea.x + (workArea.width - bounds.width) / 2);
    const y = Math.round(workArea.y + workArea.height - bounds.height - 24);

    overlayWindow.setBounds({ x, y, width: bounds.width, height: bounds.height });
  };

  const createSettingsWindow = () => {
    settingsWindow = new BrowserWindow({
      width: 1080,
      height: 760,
      minWidth: 920,
      minHeight: 680,
      title: options.appName,
      backgroundColor: '#24273a',
      autoHideMenuBar: true,
      ...(process.platform === 'darwin'
        ? {
            titleBarStyle: 'hiddenInset' as const,
            trafficLightPosition: { x: 18, y: 18 },
          }
        : {}),
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    settingsWindow.on('close', (event) => {
      if (options.isQuitting()) {
        return;
      }

      event.preventDefault();
      settingsWindow?.hide();
    });

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });

    return loadRendererPage(settingsWindow, 'index.html');
  };

  const createOverlayWindow = async () => {
    overlayWindow = new BrowserWindow({
      width: 460,
      height: 132,
      frame: false,
      transparent: true,
      show: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    keepOverlayOnCurrentSpace();
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.on('closed', () => {
      overlayWindow = null;
    });

    await loadRendererPage(overlayWindow, 'overlay.html');
    positionOverlay();
  };

  return {
    async create() {
      await Promise.all([createSettingsWindow(), createOverlayWindow()]);
    },

    showSettings() {
      if (!settingsWindow) {
        return;
      }

      settingsWindow.show();
      settingsWindow.focus();
    },

    hideSettings() {
      settingsWindow?.hide();
    },

    showOverlay() {
      if (!overlayWindow) {
        return;
      }

      positionOverlay();
      keepOverlayOnCurrentSpace();
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      overlayWindow.showInactive();
      overlayWindow.moveTop();
    },

    hideOverlay() {
      overlayWindow?.hide();
    },

    sendState(state) {
      settingsWindow?.webContents.send(DESKTOP_IPC_CHANNELS.state, state);
      overlayWindow?.webContents.send(DESKTOP_IPC_CHANNELS.state, state);
    },

    emitSound(kind) {
      overlayWindow?.webContents.send(DESKTOP_IPC_CHANNELS.sound, kind);
    },

    trackDisplayChanges() {
      screen.on('display-metrics-changed', positionOverlay);
      screen.on('display-added', positionOverlay);
      screen.on('display-removed', positionOverlay);

      return () => {
        screen.off('display-metrics-changed', positionOverlay);
        screen.off('display-added', positionOverlay);
        screen.off('display-removed', positionOverlay);
      };
    },
  };
}
