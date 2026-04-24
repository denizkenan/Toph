import { Buffer } from 'node:buffer';

import { Menu, Tray, nativeImage } from 'electron';

import type { AppState } from '@toph/desktop-contracts';

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="10" fill="#24273A"/>
      <path d="M11 10C11 9.44772 11.4477 9 12 9H20C20.5523 9 21 9.44772 21 10V19C21 21.7614 18.7614 24 16 24C13.2386 24 11 21.7614 11 19V10Z" fill="#8AADF4"/>
      <path d="M9 16C9 15.4477 9.44772 15 10 15C10.5523 15 11 15.4477 11 16V18C11 20.7614 13.2386 23 16 23C18.7614 23 21 20.7614 21 18V16C21 15.4477 21.4477 15 22 15C22.5523 15 23 15.4477 23 16V18C23 21.866 20.134 25 16.5 25.429V27H19C19.5523 27 20 27.4477 20 28C20 28.5523 19.5523 29 19 29H13C12.4477 29 12 28.5523 12 28C12 27.4477 12.4477 27 13 27H15.5V25.429C11.866 25 9 21.866 9 18V16Z" fill="#CAD3F5"/>
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  );
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
      tray = new Tray(createTrayIcon());
      tray.setToolTip(`${options.appName} dictation mock`);
      tray.on('click', options.showSettings);
      refresh();
    },
    refresh,
  };
}
