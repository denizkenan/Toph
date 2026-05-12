import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { app, globalShortcut } from 'electron';

import {
  formatShortcutChord,
  shortcutChordToElectronAccelerator,
  shortcutChordToGnomeBinding,
  type ShortcutBackend,
  type ShortcutChord,
} from '@toph/desktop-contracts';

import { createShortcutManagerCore, type ShortcutManager } from './shortcut-manager-core';
import type { DesktopStateStore } from '../state';

const execFileAsync = promisify(execFile);
const GNOME_MEDIA_KEYS_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
const GNOME_CUSTOM_KEYBINDING_SCHEMA =
  'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding';
const GNOME_TOPH_PATH = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/toph/';
const GNOME_SHORTCUT_NAME = 'Toph Toggle Dictation';

interface ShortcutSupport {
  backend: ShortcutBackend;
  registered: boolean;
  installable: boolean;
  installed: boolean;
  detail: string;
}

export interface ShortcutManagerConfig {
  launcherScriptPath: string;
  toggleCaptureFlag: string;
}

interface GlobalShortcutApi {
  register: (accelerator: string, callback: () => void) => boolean;
  unregisterAll: () => void;
}

const sessionType = (process.env.XDG_SESSION_TYPE ?? '').toLowerCase();
const currentDesktop = (
  process.env.XDG_CURRENT_DESKTOP ??
  process.env.DESKTOP_SESSION ??
  ''
).toLowerCase();

let globalShortcutsPortalPromise: Promise<boolean> | null = null;

function describeError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function quoteVariantString(value: string) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function serializeStringArray(values: string[]) {
  return `[${values.map((value) => quoteVariantString(value)).join(', ')}]`;
}

function parseQuotedStrings(value: string) {
  return Array.from(value.matchAll(/'((?:\\'|[^'])*)'/g), (match) =>
    match[1].replaceAll("\\'", "'").replaceAll('\\\\', '\\'),
  );
}

function describeShortcutRegistrationFailure(chord: ShortcutChord) {
  const label = formatShortcutChord(chord, process.platform);

  if (process.platform === 'darwin') {
    return `${label} could not be registered. macOS may reserve this shortcut for input source switching. Check System Settings > Keyboard > Keyboard Shortcuts > Input Sources, then try again.`;
  }

  return `${label} could not be registered. Another app or the operating system may already be using it.`;
}

function registerElectronShortcut(
  shortcutApi: GlobalShortcutApi,
  chord: ShortcutChord,
  onTrigger: () => void,
): ShortcutSupport {
  shortcutApi.unregisterAll();
  const registered = shortcutApi.register(shortcutChordToElectronAccelerator(chord, process.platform), onTrigger);

  return {
    backend: 'electron-global-shortcut',
    registered,
    installable: true,
    installed: registered,
    detail: registered
      ? 'Electron global shortcut registration is active.'
      : describeShortcutRegistrationFailure(chord),
  };
}

async function gsettingsGet(schema: string, key: string, path?: string) {
  const args = path ? ['get', `${schema}:${path}`, key] : ['get', schema, key];
  const { stdout } = await execFileAsync('gsettings', args);
  return stdout.trim();
}

async function gsettingsSet(schema: string, key: string, value: string, path?: string) {
  const args = path ? ['set', `${schema}:${path}`, key, value] : ['set', schema, key, value];
  await execFileAsync('gsettings', args);
}

async function supportsGlobalShortcutsPortal() {
  if (globalShortcutsPortalPromise) {
    return globalShortcutsPortalPromise;
  }

  globalShortcutsPortalPromise = (async () => {
    try {
      const { stdout } = await execFileAsync('gdbus', [
        'introspect',
        '--session',
        '--dest',
        'org.freedesktop.portal.Desktop',
        '--object-path',
        '/org/freedesktop/portal/desktop',
      ]);

      return stdout.includes('org.freedesktop.portal.GlobalShortcuts');
    } catch {
      return false;
    }
  })();

  return globalShortcutsPortalPromise;
}

async function shouldUseGnomeShortcutFallback() {
  const portalSupported = await supportsGlobalShortcutsPortal();
  const isWayland = sessionType === 'wayland';
  const isGnome = currentDesktop.includes('gnome');
  return isWayland && isGnome && !portalSupported;
}

async function installGnomeShortcut(command: string, binding: string) {
  const keybindings = parseQuotedStrings(
    await gsettingsGet(GNOME_MEDIA_KEYS_SCHEMA, 'custom-keybindings'),
  );
  const updatedKeybindings = keybindings.includes(GNOME_TOPH_PATH)
    ? keybindings
    : [...keybindings, GNOME_TOPH_PATH];

  await gsettingsSet(
    GNOME_MEDIA_KEYS_SCHEMA,
    'custom-keybindings',
    serializeStringArray(updatedKeybindings),
  );
  await gsettingsSet(
    GNOME_CUSTOM_KEYBINDING_SCHEMA,
    'name',
    quoteVariantString(GNOME_SHORTCUT_NAME),
    GNOME_TOPH_PATH,
  );
  await gsettingsSet(
    GNOME_CUSTOM_KEYBINDING_SCHEMA,
    'command',
    quoteVariantString(command),
    GNOME_TOPH_PATH,
  );
  await gsettingsSet(
    GNOME_CUSTOM_KEYBINDING_SCHEMA,
    'binding',
    quoteVariantString(binding),
    GNOME_TOPH_PATH,
  );
}

async function suspendGnomeShortcut() {
  await gsettingsSet(
    GNOME_CUSTOM_KEYBINDING_SCHEMA,
    'binding',
    quoteVariantString(''),
    GNOME_TOPH_PATH,
  );
}

function getShortcutLauncherCommand(config: ShortcutManagerConfig) {
  if (app.isPackaged) {
    return `${shellQuote(process.execPath)} ${config.toggleCaptureFlag}`;
  }

  return `sh ${shellQuote(config.launcherScriptPath)} ${config.toggleCaptureFlag}`;
}

async function registerLinuxShortcut(
  config: ShortcutManagerConfig,
  shortcutApi: GlobalShortcutApi,
  chord: ShortcutChord,
  onTrigger: () => void,
): Promise<ShortcutSupport> {
  if (!(await shouldUseGnomeShortcutFallback())) {
    return registerElectronShortcut(shortcutApi, chord, onTrigger);
  }

  shortcutApi.unregisterAll();

  try {
    await installGnomeShortcut(getShortcutLauncherCommand(config), shortcutChordToGnomeBinding(chord));

    return {
      backend: 'gnome-custom-shortcut',
      registered: true,
      installable: true,
      installed: true,
      detail: `GNOME custom shortcut fallback is installed. ${formatShortcutChord(chord, process.platform)} should trigger Toph even when another app is focused.`,
    };
  } catch (error) {
    return {
      backend: 'gnome-custom-shortcut',
      registered: false,
      installable: true,
      installed: false,
      detail: `GNOME custom shortcut fallback could not be installed. ${describeError(error)}.`,
    };
  }
}

async function registerShortcut(
  config: ShortcutManagerConfig,
  shortcutApi: GlobalShortcutApi,
  chord: ShortcutChord,
  onTrigger: () => void,
) {
  if (process.platform === 'linux') {
    return registerLinuxShortcut(config, shortcutApi, chord, onTrigger);
  }

  return registerElectronShortcut(shortcutApi, chord, onTrigger);
}

export function createShortcutManager(options: {
  stateStore: DesktopStateStore;
  config: ShortcutManagerConfig;
  onTrigger: () => void;
  persistShortcut: (chord: ShortcutChord) => Promise<void>;
  shortcutApi?: GlobalShortcutApi;
}): ShortcutManager {
  const shortcutApi = options.shortcutApi ?? globalShortcut;
  return createShortcutManagerCore({
    stateStore: options.stateStore,
    persistShortcut: options.persistShortcut,
    registerShortcut: (chord) => registerShortcut(options.config, shortcutApi, chord, options.onTrigger),
    suspendShortcut: async () => {
      shortcutApi.unregisterAll();
      if (options.stateStore.getState().shortcut.backend === 'gnome-custom-shortcut') {
        await suspendGnomeShortcut();
      }
    },
    unregisterShortcut: () => {
      shortcutApi.unregisterAll();
    },
  });
}

export type { ShortcutManager };
