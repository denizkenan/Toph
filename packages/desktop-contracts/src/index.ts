export const DESKTOP_IPC_CHANNELS = {
  subscribeState: 'toph:subscribe-state',
  state: 'toph:state',
  toggleCapture: 'toph:toggle-capture',
  showSettings: 'toph:show-settings',
  hideSettings: 'toph:hide-settings',
  installShortcut: 'toph:install-shortcut',
  performPermissionAction: 'toph:perform-permission-action',
  refreshPermissions: 'toph:refresh-permissions',
  sound: 'toph:sound',
  quit: 'toph:quit',
} as const;

// Shared because the main process owns the transparent Electron window while
// the renderer must keep the visible overlay within this fixed runtime surface.
export const OVERLAY_WINDOW_GEOMETRY = {
  width: 400,
  height: 80,
} as const;

export type ShortcutPresetId =
  | 'toggle-dictation-primary'
  | 'toggle-dictation-secondary'
  | 'toggle-dictation-tertiary';

export interface ShortcutPreset {
  id: ShortcutPresetId;
  accelerator: string;
  label: string;
  gnomeBinding: string;
  darwinAccelerator?: string;
  darwinLabel?: string;
}

export const SHORTCUT_PRESETS: readonly ShortcutPreset[] = [
  {
    id: 'toggle-dictation-primary',
    accelerator: 'CommandOrControl+Alt+Space',
    label: 'Ctrl+Alt+Space',
    gnomeBinding: '<Primary><Alt>space',
    darwinAccelerator: 'Control+Option+Space',
    darwinLabel: 'Ctrl+Option+Space',
  },
  {
    id: 'toggle-dictation-secondary',
    accelerator: 'CommandOrControl+Shift+Space',
    label: 'Ctrl+Shift+Space',
    gnomeBinding: '<Primary><Shift>space',
  },
  {
    id: 'toggle-dictation-tertiary',
    accelerator: 'CommandOrControl+Alt+Shift+Space',
    label: 'Ctrl+Alt+Shift+Space',
    gnomeBinding: '<Primary><Alt><Shift>space',
    darwinAccelerator: 'Control+Option+Shift+Space',
    darwinLabel: 'Ctrl+Option+Shift+Space',
  },
];

export const DEFAULT_SHORTCUT_PRESET = SHORTCUT_PRESETS[0];

export function resolveShortcutPresetForPlatform(
  presetId: ShortcutPresetId,
  platform: NodeJS.Platform,
): ShortcutPreset {
  const preset = SHORTCUT_PRESETS.find((item) => item.id === presetId) ?? DEFAULT_SHORTCUT_PRESET;

  if (platform !== 'darwin') {
    return preset;
  }

  return {
    ...preset,
    accelerator: preset.darwinAccelerator ?? preset.accelerator,
    label: preset.darwinLabel ?? preset.label,
  };
}

export type DictationPhase = 'idle' | 'listening' | 'transcribing';
export type PasteAttemptStatus = 'idle' | 'clipboard-only' | 'success' | 'failed';
export type SoundEventKind = 'start' | 'stop' | 'done';
export type ShortcutBackend = 'electron-global-shortcut' | 'gnome-custom-shortcut';
export type PermissionRequirementId = 'microphone' | 'accessibility';
export const PERMISSION_REQUIREMENT_IDS: readonly PermissionRequirementId[] = [
  'microphone',
  'accessibility',
];
export type PermissionRequirementStatus =
  | 'granted'
  | 'missing'
  | 'promptable'
  | 'denied'
  | 'not-required'
  | 'unknown';
export type PermissionRequirementAction = 'request' | 'open-settings' | 'recheck' | 'none';

export interface PasteSupport {
  helper: string | null;
  detail: string;
}

export interface PasteAttempt {
  helper: string | null;
  status: PasteAttemptStatus;
  detail: string;
}

export interface ConversionRecord {
  id: string;
  text: string;
  createdAt: number;
  pasteStatus: PasteAttemptStatus;
  pasteDetail: string;
}

export interface PermissionRequirement {
  id: PermissionRequirementId;
  label: string;
  status: PermissionRequirementStatus;
  required: boolean;
  detail: string;
  action: PermissionRequirementAction;
}

export interface PermissionState {
  ready: boolean;
  requirements: PermissionRequirement[];
}

export interface AppState {
  phase: DictationPhase;
  shortcut: {
    presetId: ShortcutPresetId;
    accelerator: string;
    label: string;
    registered: boolean;
    backend: ShortcutBackend;
    detail: string;
    installable: boolean;
    installed: boolean;
  };
  environment: {
    platform: NodeJS.Platform;
    sessionType: string;
    currentDesktop: string;
  };
  permissions: PermissionState;
  pasteSupport: PasteSupport;
  lastPasteAttempt: PasteAttempt;
  lastTranscript: string | null;
  recentConversions: ConversionRecord[];
  updatedAt: number;
}

export interface DesktopApi {
  /**
   * Subscribe to the desktop state stream.
   * The listener receives the current snapshot first, then later updates in send order.
   */
  subscribeState: (listener: (state: AppState) => void) => () => void;
  toggleCapture: () => Promise<void>;
  showSettings: () => Promise<void>;
  hideSettings: () => Promise<void>;
  installShortcut: (presetId: ShortcutPresetId) => Promise<void>;
  performPermissionAction: (permissionId: PermissionRequirementId) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  onSoundEvent: (listener: (kind: SoundEventKind) => void) => () => void;
  quit: () => Promise<void>;
}
