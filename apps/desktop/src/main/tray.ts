import { readFileSync } from 'node:fs';

import { Menu, Tray, nativeImage, nativeTheme } from 'electron';

import trayIconDark2x from '../../../../assets/tray-icon-dark@2x.png?asset';
import trayIconDark from '../../../../assets/tray-icon-dark.png?asset';
import trayIconLight2x from '../../../../assets/tray-icon-light@2x.png?asset';
import trayIconLight from '../../../../assets/tray-icon-light.png?asset';
import trayIconTemplate2x from '../../../../assets/tray-iconTemplate@2x.png?asset';
import trayIconTemplate from '../../../../assets/tray-iconTemplate.png?asset';

import type { AppState } from '@toph/desktop-contracts';

function getTrayIconPaths(): { icon1x: string; icon2x: string } {
  if (process.platform === 'darwin') {
    return { icon1x: trayIconTemplate, icon2x: trayIconTemplate2x };
  }

  // Windows and Linux: manual check
  if (nativeTheme.shouldUseDarkColors) {
    return { icon1x: trayIconDark, icon2x: trayIconDark2x };
  } else {
    return { icon1x: trayIconLight, icon2x: trayIconLight2x };
  }
}

function createTrayIcon() {
  const { icon1x, icon2x } = getTrayIconPaths();
  const image = nativeImage.createFromPath(icon1x);

  if (image.isEmpty()) {
    throw new Error(`Failed to load tray icon asset: ${icon1x}`);
  }

  // Vite emits hashed asset names, so do not rely on Electron discovering
  // @2x siblings by filename. Add the high-DPI representation explicitly.
  image.addRepresentation({
    scaleFactor: 2,
    buffer: readFileSync(icon2x),
  });

  // Vite also mangles the Template suffix, so force template rendering.
  if (process.platform === 'darwin') {
    image.setTemplateImage(true);
  }

  return image;
}

export interface DesktopTrayController {
  create: () => void;
  refresh: () => void;
}

export function createDesktopTrayController(options: {
  appName: string;
  getState: () => AppState;
  showSettings: () => void;
  toggleCapture: () => Promise<void>;
  quit: () => void;
}): DesktopTrayController {
  let tray: Tray | null = null;

  const refresh = () => {
    if (!tray) {
      return;
    }

    const state = options.getState();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: state.phase === 'listening' ? 'Stop Listening' : 'Start Dictation',
          click: () => {
            void options.toggleCapture();
          },
        },
        {
          label: `Shortcut: ${state.shortcut.label}`,
          enabled: false,
        },
        {
          label: 'Show Settings',
          click: options.showSettings,
        },
        {
          type: 'separator',
        },
        {
          label: 'Quit',
          click: options.quit,
        },
      ]),
    );
  };

  return {
    create() {
      if (tray) {
        return;
      }

      tray = new Tray(createTrayIcon());
      tray.setToolTip(`${options.appName} dictation mock`);
      tray.on('click', options.showSettings);

      if (process.platform !== 'darwin') {
        nativeTheme.on('updated', () => {
          if (tray) {
            tray.setImage(createTrayIcon());
          }
        });
      }

      refresh();
    },
    refresh,
  };
}
