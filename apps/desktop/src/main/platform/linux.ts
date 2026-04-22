import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type { PasteAttempt, PasteSupport } from '../../shared/contracts'
import type { ShortcutSupport } from './index'

const execFileAsync = promisify(execFile)
const GNOME_MEDIA_KEYS_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys'
const GNOME_CUSTOM_KEYBINDING_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding'
const GNOME_TOPH_PATH = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/toph/'
const GNOME_SHORTCUT_NAME = 'Toph Toggle Dictation'

type PasteHelper = {
  name: string
  args: string[]
  supported: boolean
}

const sessionType = (process.env.XDG_SESSION_TYPE ?? '').toLowerCase()
const currentDesktop = (process.env.XDG_CURRENT_DESKTOP ?? process.env.DESKTOP_SESSION ?? '').toLowerCase()

let helperPromise: Promise<PasteHelper | null> | null = null
let globalShortcutsPortalPromise: Promise<boolean> | null = null

function quoteVariantString(value: string) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function serializeStringArray(values: string[]) {
  return `[${values.map((value) => quoteVariantString(value)).join(', ')}]`
}

function parseQuotedStrings(value: string) {
  return Array.from(value.matchAll(/'((?:\\'|[^'])*)'/g), (match) =>
    match[1].replaceAll("\\'", "'").replaceAll('\\\\', '\\'),
  )
}

async function gsettingsGet(schema: string, key: string, path?: string) {
  const args = path ? ['get', `${schema}:${path}`, key] : ['get', schema, key]
  const { stdout } = await execFileAsync('gsettings', args)
  return stdout.trim()
}

async function gsettingsSet(schema: string, key: string, value: string, path?: string) {
  const args = path ? ['set', `${schema}:${path}`, key, value] : ['set', schema, key, value]
  await execFileAsync('gsettings', args)
}

async function supportsGlobalShortcutsPortal() {
  if (globalShortcutsPortalPromise) {
    return globalShortcutsPortalPromise
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
      ])

      return stdout.includes('org.freedesktop.portal.GlobalShortcuts')
    } catch {
      return false
    }
  })()

  return globalShortcutsPortalPromise
}

async function isGnomeShortcutInstalled(command: string | null, expectedBinding: string) {
  try {
    const keybindings = parseQuotedStrings(await gsettingsGet(GNOME_MEDIA_KEYS_SCHEMA, 'custom-keybindings'))
    if (!keybindings.includes(GNOME_TOPH_PATH)) {
      return false
    }

    const installedBinding = parseQuotedStrings(
      await gsettingsGet(GNOME_CUSTOM_KEYBINDING_SCHEMA, 'binding', GNOME_TOPH_PATH),
    )[0]
    const installedCommand = parseQuotedStrings(
      await gsettingsGet(GNOME_CUSTOM_KEYBINDING_SCHEMA, 'command', GNOME_TOPH_PATH),
    )[0]

    return installedBinding === expectedBinding && (!command || installedCommand === command)
  } catch {
    return false
  }
}

async function installGnomeShortcut(command: string, binding: string) {
  const keybindings = parseQuotedStrings(await gsettingsGet(GNOME_MEDIA_KEYS_SCHEMA, 'custom-keybindings'))
  const updatedKeybindings = keybindings.includes(GNOME_TOPH_PATH) ? keybindings : [...keybindings, GNOME_TOPH_PATH]

  await gsettingsSet(GNOME_MEDIA_KEYS_SCHEMA, 'custom-keybindings', serializeStringArray(updatedKeybindings))
  await gsettingsSet(GNOME_CUSTOM_KEYBINDING_SCHEMA, 'name', quoteVariantString(GNOME_SHORTCUT_NAME), GNOME_TOPH_PATH)
  await gsettingsSet(GNOME_CUSTOM_KEYBINDING_SCHEMA, 'command', quoteVariantString(command), GNOME_TOPH_PATH)
  await gsettingsSet(
    GNOME_CUSTOM_KEYBINDING_SCHEMA,
    'binding',
    quoteVariantString(binding),
    GNOME_TOPH_PATH,
  )
}

async function describeShortcutSupport(options: {
  electronRegistered: boolean
  command: string | null
  binding: string
  label: string
}): Promise<ShortcutSupport> {
  const portalSupported = await supportsGlobalShortcutsPortal()
  const isWayland = sessionType === 'wayland'
  const isGnome = currentDesktop.includes('gnome')

  if (!isWayland || portalSupported || !isGnome) {
    return {
      backend: 'electron-global-shortcut',
      registered: options.electronRegistered,
      installable: false,
      installed: false,
      detail: options.electronRegistered
        ? 'Electron global shortcut registration is active.'
        : 'Electron global shortcut registration is unavailable right now.',
    }
  }

  const installed = await isGnomeShortcutInstalled(options.command, options.binding)

  return {
    backend: 'gnome-custom-shortcut',
    registered: installed,
    installable: Boolean(options.command),
    installed,
    detail: installed
      ? `GNOME custom shortcut fallback is installed. ${options.label} should trigger Toph even when another app is focused.`
      : `GNOME 46 on Wayland does not expose the global shortcuts portal. Install the GNOME shortcut fallback to make ${options.label} global.`,
  }
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync('which', [command])
    return true
  } catch {
    return false
  }
}

async function resolveHelper(): Promise<PasteHelper | null> {
  if (helperPromise) {
    return helperPromise
  }

  helperPromise = (async () => {
    const isWayland = sessionType === 'wayland'
    const isGnome = currentDesktop.includes('gnome')

    if (isWayland && isGnome) {
      if (await commandExists('ydotool')) {
        return {
          name: 'ydotool',
          args: ['key', '29:1', '47:1', '47:0', '29:0'],
          supported: true,
        }
      }

      return null
    }

    if (isWayland && (await commandExists('wtype'))) {
      return {
        name: 'wtype',
        args: ['-M', 'ctrl', 'v', '-m', 'ctrl'],
        supported: true,
      }
    }

    if (await commandExists('ydotool')) {
      return {
        name: 'ydotool',
        args: ['key', '29:1', '47:1', '47:0', '29:0'],
        supported: true,
      }
    }

    if (!isWayland && (await commandExists('xdotool'))) {
      return {
        name: 'xdotool',
        args: ['key', '--clearmodifiers', 'ctrl+v'],
        supported: true,
      }
    }

    return null
  })()

  return helperPromise
}

function runHelper(helper: PasteHelper): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(helper.name, helper.args, { stdio: 'ignore' })
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      resolve(false)
    }, 1500)

    child.once('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })

    child.once('exit', (code) => {
      clearTimeout(timeout)
      resolve(code === 0)
    })
  })
}

export function createLinuxPlatformAdapter() {
  return {
    async describePasteSupport(): Promise<PasteSupport> {
      const helper = await resolveHelper()

      if (helper?.supported) {
        return {
          helper: helper.name,
          detail: `Clipboard-first mode is active. Auto-paste will be attempted with ${helper.name}.`,
        }
      }

      if (sessionType === 'wayland' && currentDesktop.includes('gnome')) {
        return {
          helper: null,
          detail: 'Clipboard-first mode is active. GNOME on Wayland blocks synthetic paste unless a helper like ydotool is available.',
        }
      }

      if (sessionType === 'wayland') {
        return {
          helper: null,
          detail: 'Clipboard-first mode is active. Auto-paste needs a compositor-compatible helper on Wayland.',
        }
      }

      return {
        helper: null,
        detail: 'Clipboard-first mode is active. Auto-paste needs an installed helper such as xdotool.',
      }
    },

    async pasteFromClipboard(): Promise<PasteAttempt> {
      const helper = await resolveHelper()

      if (!helper?.supported) {
        return {
          helper: null,
          status: 'clipboard-only',
          detail: 'Transcript copied to the clipboard. Automatic paste is unavailable in this Linux session right now.',
        }
      }

      const pasted = await runHelper(helper)

      if (pasted) {
        return {
          helper: helper.name,
          status: 'success',
          detail: `Transcript copied to the clipboard and paste was attempted with ${helper.name}.`,
        }
      }

      return {
        helper: helper.name,
        status: 'failed',
        detail: `Transcript copied to the clipboard. ${helper.name} was found, but the paste attempt failed.`,
      }
    },

    async describeShortcutSupport(options: {
      electronRegistered: boolean
      command: string | null
      binding: string
      label: string
    }) {
      return describeShortcutSupport(options)
    },

    async installShortcut({ command, binding, label }: { command: string | null; binding: string; label: string }) {
      if (!command) {
        throw new Error('A launcher command is required to install the GNOME shortcut fallback.')
      }

      await installGnomeShortcut(command, binding)
      return describeShortcutSupport({ electronRegistered: false, command, binding, label })
    },
  }
}
