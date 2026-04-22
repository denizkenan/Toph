import { Buffer } from 'node:buffer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  clipboard,
  ipcMain,
  nativeImage,
  screen,
} from 'electron';

import {
  APP_NAME,
  DEFAULT_SHORTCUT_PRESET,
  MOCK_TRANSCRIPT,
  type AppState,
  type DictationPhase,
  type ShortcutPresetId,
  type SoundEventKind,
  SHORTCUT_PRESETS,
} from '@toph/desktop-contracts';

import { createPlatformAdapter } from './platform';

const platformAdapter = createPlatformAdapter();
const toggleCaptureFlag = '--toggle-capture';
const shouldToggleOnLaunch = process.argv.includes(toggleCaptureFlag);

const isLinux = process.platform === 'linux';
if (isLinux) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(__dirname, '../preload/index.mjs');
const launcherScriptPath = join(__dirname, '../../../../scripts/toph-desktop.sh');

let settingsWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let transcribeTimer: NodeJS.Timeout | null = null;
let lastToggleRequestAt = 0;

const toggleDebounceMs = 800;

function resolveShortcutPreset(presetId: ShortcutPresetId) {
  return SHORTCUT_PRESETS.find((preset) => preset.id === presetId) ?? DEFAULT_SHORTCUT_PRESET;
}

const state: AppState = {
  phase: 'idle',
  shortcut: {
    presetId: DEFAULT_SHORTCUT_PRESET.id,
    accelerator: DEFAULT_SHORTCUT_PRESET.accelerator,
    label: DEFAULT_SHORTCUT_PRESET.label,
    registered: false,
    backend: 'electron-global-shortcut',
    detail: 'Inspecting global shortcut support...',
    installable: false,
    installed: false,
  },
  environment: {
    platform: process.platform,
    sessionType: process.env.XDG_SESSION_TYPE ?? 'unknown',
    currentDesktop: process.env.XDG_CURRENT_DESKTOP ?? process.env.DESKTOP_SESSION ?? 'unknown',
  },
  pasteSupport: {
    helper: null,
    detail: 'Inspecting clipboard and paste capabilities...',
  },
  lastPasteAttempt: {
    helper: null,
    status: 'idle',
    detail: 'No transcript has been pasted yet.',
  },
  lastTranscript: null,
  recentConversions: [],
  updatedAt: Date.now(),
};

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

function emitState() {
  state.updatedAt = Date.now();
  settingsWindow?.webContents.send('toph:state-changed', state);
  overlayWindow?.webContents.send('toph:state-changed', state);
}

function emitSound(kind: SoundEventKind) {
  overlayWindow?.webContents.send('toph:sound', kind);
}

function patchState(partial: Partial<AppState>) {
  Object.assign(state, partial);
  emitState();
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function getShortcutLauncherCommand() {
  if (app.isPackaged) {
    return `${shellQuote(process.execPath)} ${toggleCaptureFlag}`;
  }

  return `sh ${shellQuote(launcherScriptPath)} ${toggleCaptureFlag}`;
}

function getRendererUrl(page: 'index.html' | 'overlay.html') {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${page}`;
  }

  return join(__dirname, `../renderer/${page}`);
}

async function loadRendererPage(window: BrowserWindow, page: 'index.html' | 'overlay.html') {
  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(getRendererUrl(page));
    return;
  }

  await window.loadFile(getRendererUrl(page));
}

function positionOverlay() {
  if (!overlayWindow) {
    return;
  }

  const { workArea } = screen.getPrimaryDisplay();
  const bounds = overlayWindow.getBounds();
  const x = Math.round(workArea.x + (workArea.width - bounds.width) / 2);
  const y = Math.round(workArea.y + workArea.height - bounds.height - 24);

  overlayWindow.setBounds({ x, y, width: bounds.width, height: bounds.height });
}

function showSettingsWindow() {
  if (!settingsWindow) {
    return;
  }

  settingsWindow.show();
  settingsWindow.focus();
}

function hideSettingsWindow() {
  settingsWindow?.hide();
}

function showOverlay(phase: DictationPhase) {
  if (!overlayWindow) {
    return;
  }

  positionOverlay();
  overlayWindow.showInactive();
  patchState({ phase });
}

function hideOverlay() {
  overlayWindow?.hide();
}

async function beginListening() {
  if (transcribeTimer) {
    clearTimeout(transcribeTimer);
    transcribeTimer = null;
  }

  showOverlay('listening');
  patchState({
    lastPasteAttempt: {
      helper: state.lastPasteAttempt.helper,
      status: 'idle',
      detail: 'Listening for mock speech input...',
    },
  });
  emitSound('start');
}

async function finalizeTranscription() {
  clipboard.writeText(MOCK_TRANSCRIPT);

  const lastPasteAttempt = await platformAdapter.pasteFromClipboard();
  const createdAt = Date.now();
  const nextConversion = {
    id: `${createdAt}`,
    text: MOCK_TRANSCRIPT,
    createdAt,
    pasteStatus: lastPasteAttempt.status,
    pasteDetail: lastPasteAttempt.detail,
  };

  patchState({
    phase: 'idle',
    lastTranscript: MOCK_TRANSCRIPT,
    lastPasteAttempt,
    recentConversions: [nextConversion, ...state.recentConversions].slice(0, 8),
  });

  emitSound('done');
  setTimeout(() => {
    hideOverlay();
  }, 420);
}

async function finishListening() {
  patchState({
    phase: 'transcribing',
    lastPasteAttempt: {
      helper: state.lastPasteAttempt.helper,
      status: 'idle',
      detail: 'Mock transcription is underway...',
    },
  });
  emitSound('stop');

  transcribeTimer = setTimeout(() => {
    void finalizeTranscription();
  }, 1300);
}

async function toggleCapture() {
  const now = Date.now();
  if (now - lastToggleRequestAt < toggleDebounceMs) {
    return;
  }

  lastToggleRequestAt = now;

  if (state.phase === 'idle') {
    await beginListening();
    return;
  }

  if (state.phase === 'listening') {
    await finishListening();
  }
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 920,
    minHeight: 680,
    title: APP_NAME,
    backgroundColor: '#24273a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    settingsWindow?.hide();
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.hide();
  });

  void loadRendererPage(settingsWindow, 'index.html');
}

function createOverlayWindow() {
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

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  void loadRendererPage(overlayWindow, 'overlay.html').then(() => {
    positionOverlay();
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(`${APP_NAME} dictation mock`);

  const refreshMenu = () => {
    if (!tray) {
      return;
    }

    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: state.phase === 'listening' ? 'Stop Listening' : 'Start Dictation',
          click: () => {
            void toggleCapture();
          },
        },
        {
          label: `Shortcut: ${state.shortcut.label}`,
          enabled: false,
        },
        {
          label: 'Show Settings',
          click: showSettingsWindow,
        },
        {
          type: 'separator',
        },
        {
          label: 'Quit',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]),
    );
  };

  refreshMenu();
  tray.on('click', showSettingsWindow);
  ipcMain.on('toph:refresh-tray', refreshMenu);
}

async function applyShortcutPreset(presetId: ShortcutPresetId) {
  const preset = resolveShortcutPreset(presetId);
  const shortcut = await platformAdapter.registerShortcut({
    accelerator: preset.accelerator,
    command: getShortcutLauncherCommand(),
    binding: preset.gnomeBinding,
    label: preset.label,
    onTrigger: () => {
      void toggleCapture();
    },
  });

  patchState({
    shortcut: {
      ...state.shortcut,
      presetId: preset.id,
      accelerator: preset.accelerator,
      label: preset.label,
      ...shortcut,
    },
  });
}

function registerIpc() {
  ipcMain.handle('toph:get-state', async () => state);
  ipcMain.handle('toph:toggle-capture', async () => {
    await toggleCapture();
  });
  ipcMain.handle('toph:show-settings', async () => {
    showSettingsWindow();
  });
  ipcMain.handle('toph:hide-settings', async () => {
    hideSettingsWindow();
  });
  ipcMain.handle('toph:install-shortcut', async (_event, presetId: ShortcutPresetId) => {
    await applyShortcutPreset(presetId);
  });
  ipcMain.handle('toph:quit', async () => {
    isQuitting = true;
    app.quit();
  });
}

async function bootstrap() {
  app.setName(APP_NAME);

  const singleInstance = app.requestSingleInstanceLock();
  if (!singleInstance) {
    app.quit();
    return;
  }

  app.on('second-instance', (_event, argv) => {
    if (argv.includes(toggleCaptureFlag)) {
      void toggleCapture();
      return;
    }

    showSettingsWindow();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  await app.whenReady();
  registerIpc();
  createSettingsWindow();
  createOverlayWindow();
  createTray();
  await applyShortcutPreset(state.shortcut.presetId);

  screen.on('display-metrics-changed', positionOverlay);
  screen.on('display-added', positionOverlay);
  screen.on('display-removed', positionOverlay);

  patchState({
    pasteSupport: await platformAdapter.describePasteSupport(),
  });

  if (shouldToggleOnLaunch) {
    void toggleCapture();
  }

  app.on('activate', () => {
    showSettingsWindow();
  });

  app.on('will-quit', () => {
    platformAdapter.unregisterShortcut();
  });
}

void bootstrap();
