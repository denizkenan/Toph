import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { app, globalShortcut } from 'electron';

import {
  resolveShortcutPresetForPlatform,
  type ShortcutBackend,
  type ShortcutPreset,
  type ShortcutPresetId,
} from '@toph/desktop-contracts';

import type { ShortcutStateSupport, DesktopStateStore } from '../state';

const execFileAsync = promisify(execFile);
const GNOME_MEDIA_KEYS_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
const GNOME_CUSTOM_KEYBINDING_SCHEMA =
  'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding';
const GNOME_TOPH_PATH = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/toph/';
const GNOME_SHORTCUT_NAME = 'Toph Toggle Dictation';

export interface ShortcutManager {
  applyPreset: (presetId: ShortcutPresetId) => Promise<void>;
  unregister: () => void;
}

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

function resolveShortcutPreset(presetId: ShortcutPresetId) {
  return resolveShortcutPresetForPlatform(presetId, process.platform);
}

function describeShortcutRegistrationFailure(preset: ShortcutPreset) {
  if (process.platform === 'darwin') {
    return `${preset.label} could not be registered. macOS may reserve this shortcut for input source switching. Check System Settings > Keyboard > Keyboard Shortcuts > Input Sources, then try again.`;
  }

  return 'Electron global shortcut registration is unavailable right now.';
}

function registerElectronShortcut(preset: ShortcutPreset, onTrigger: () => void): ShortcutSupport {
  globalShortcut.unregisterAll();
  const registered = globalShortcut.register(preset.accelerator, onTrigger);

  return {
    backend: 'electron-global-shortcut',
    registered,
    installable: true,
    installed: registered,
    detail: registered
      ? 'Electron global shortcut registration is active.'
      : describeShortcutRegistrationFailure(preset),
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

function getShortcutLauncherCommand(config: ShortcutManagerConfig) {
  if (app.isPackaged) {
    return `${shellQuote(process.execPath)} ${config.toggleCaptureFlag}`;
  }

  return `sh ${shellQuote(config.launcherScriptPath)} ${config.toggleCaptureFlag}`;
}

async function registerLinuxShortcut(
  config: ShortcutManagerConfig,
  preset: ShortcutPreset,
  onTrigger: () => void,
): Promise<ShortcutSupport> {
  if (!(await shouldUseGnomeShortcutFallback())) {
    return registerElectronShortcut(preset, onTrigger);
  }

  globalShortcut.unregisterAll();

  try {
    await installGnomeShortcut(getShortcutLauncherCommand(config), preset.gnomeBinding);

    return {
      backend: 'gnome-custom-shortcut',
      registered: true,
      installable: true,
      installed: true,
      detail: `GNOME custom shortcut fallback is installed. ${preset.label} should trigger Toph even when another app is focused.`,
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
  preset: ShortcutPreset,
  onTrigger: () => void,
) {
  if (process.platform === 'linux') {
    return registerLinuxShortcut(config, preset, onTrigger);
  }

  return registerElectronShortcut(preset, onTrigger);
}

function toUnexpectedFailureSupport(
  preset: ShortcutPreset,
  currentSupport: ShortcutStateSupport,
  error: unknown,
): ShortcutStateSupport {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return {
    backend: currentSupport.backend,
    registered: false,
    installable: currentSupport.installable,
    installed: false,
    detail: `Failed to apply ${preset.label}. ${detail}.`,
  };
}

export function createShortcutManager(options: {
  stateStore: DesktopStateStore;
  config: ShortcutManagerConfig;
  onTrigger: () => void;
}): ShortcutManager {
  return {
    async applyPreset(presetId) {
      const preset = resolveShortcutPreset(presetId);

      try {
        const support = await registerShortcut(options.config, preset, options.onTrigger);
        options.stateStore.setShortcut(preset, support);
      } catch (error) {
        options.stateStore.setShortcut(
          preset,
          toUnexpectedFailureSupport(preset, options.stateStore.getState().shortcut, error),
        );
      }
    },

    unregister() {
      globalShortcut.unregisterAll();
    },
  };
}
