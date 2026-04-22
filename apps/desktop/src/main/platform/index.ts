import type { PasteAttempt, PasteSupport, ShortcutBackend } from '../../shared/contracts'
import { createLinuxPlatformAdapter } from './linux'

export interface ShortcutSupport {
  backend: ShortcutBackend
  registered: boolean
  installable: boolean
  installed: boolean
  detail: string
}

export interface PlatformAdapter {
  describePasteSupport: () => Promise<PasteSupport>
  pasteFromClipboard: () => Promise<PasteAttempt>
  describeShortcutSupport: (options: {
    electronRegistered: boolean
    command: string | null
    binding: string
    label: string
  }) => Promise<ShortcutSupport>
  installShortcut: (options: { command: string | null; binding: string; label: string }) => Promise<ShortcutSupport>
}

export function createPlatformAdapter(): PlatformAdapter {
  if (process.platform === 'linux') {
    return createLinuxPlatformAdapter()
  }

  return {
    async describePasteSupport() {
      return {
        helper: null,
        detail: 'Clipboard write is ready. Auto-paste is not implemented for this platform yet.',
      }
    },
    async pasteFromClipboard() {
      return {
        helper: null,
        status: 'clipboard-only',
        detail: 'Transcript copied to clipboard. Auto-paste is not implemented for this platform yet.',
      }
    },
    async describeShortcutSupport({ electronRegistered }) {
      return {
        backend: 'electron-global-shortcut',
        registered: electronRegistered,
        installable: false,
        installed: false,
        detail: electronRegistered
          ? 'Electron global shortcut registration is active.'
          : 'Electron global shortcut registration is unavailable right now.',
      }
    },
    async installShortcut() {
      throw new Error('Shortcut installation is not implemented for this platform.')
    },
  }
}
