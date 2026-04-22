export const APP_NAME = 'Toph';
export const MOCK_TRANSCRIPT =
  'This is a mocked Toph dictation result. Real transcription plugs in next.';

export type ShortcutPresetId = 'ctrl-alt-space' | 'ctrl-shift-space' | 'ctrl-alt-shift-space';

export interface ShortcutPreset {
  id: ShortcutPresetId;
  accelerator: string;
  label: string;
  gnomeBinding: string;
}

export const SHORTCUT_PRESETS: readonly ShortcutPreset[] = [
  {
    id: 'ctrl-alt-space',
    accelerator: 'CommandOrControl+Alt+Space',
    label: 'Ctrl+Alt+Space',
    gnomeBinding: '<Primary><Alt>space',
  },
  {
    id: 'ctrl-shift-space',
    accelerator: 'CommandOrControl+Shift+Space',
    label: 'Ctrl+Shift+Space',
    gnomeBinding: '<Primary><Shift>space',
  },
  {
    id: 'ctrl-alt-shift-space',
    accelerator: 'CommandOrControl+Alt+Shift+Space',
    label: 'Ctrl+Alt+Shift+Space',
    gnomeBinding: '<Primary><Alt><Shift>space',
  },
];

export const DEFAULT_SHORTCUT_PRESET = SHORTCUT_PRESETS[0];

export type DictationPhase = 'idle' | 'listening' | 'transcribing';
export type PasteAttemptStatus = 'idle' | 'clipboard-only' | 'success' | 'failed';
export type SoundEventKind = 'start' | 'stop' | 'done';
export type ShortcutBackend = 'electron-global-shortcut' | 'gnome-custom-shortcut';

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
  pasteSupport: PasteSupport;
  lastPasteAttempt: PasteAttempt;
  lastTranscript: string | null;
  recentConversions: ConversionRecord[];
  updatedAt: number;
}

export interface DesktopApi {
  getState: () => Promise<AppState>;
  toggleCapture: () => Promise<void>;
  showSettings: () => Promise<void>;
  hideSettings: () => Promise<void>;
  installShortcut: (presetId: ShortcutPresetId) => Promise<void>;
  onStateChange: (listener: (state: AppState) => void) => () => void;
  onSoundEvent: (listener: (kind: SoundEventKind) => void) => () => void;
  quit: () => Promise<void>;
}
