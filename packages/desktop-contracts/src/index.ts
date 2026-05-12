export const DESKTOP_IPC_CHANNELS = {
  subscribeState: 'toph:subscribe-state',
  state: 'toph:state',
  toggleCapture: 'toph:toggle-capture',
  cancelCapture: 'toph:cancel-capture',
  resizeOverlay: 'toph:resize-overlay',
  showSettings: 'toph:show-settings',
  hideSettings: 'toph:hide-settings',
  installShortcut: 'toph:install-shortcut',
  connectProvider: 'toph:connect-provider',
  submitProviderAuthorization: 'toph:submit-provider-authorization',
  removeProvider: 'toph:remove-provider',
  refreshProviders: 'toph:refresh-providers',
  setAuthProvider: 'toph:set-auth-provider',
  setTranscriptionProvider: 'toph:set-transcription-provider',
  setTranscriptionModel: 'toph:set-transcription-model',
  setInferenceProvider: 'toph:set-inference-provider',
  setInferenceModel: 'toph:set-inference-model',
  setPolishEnabled: 'toph:set-polish-enabled',
  setActivePolishPrompt: 'toph:set-active-polish-prompt',
  performPermissionAction: 'toph:perform-permission-action',
  refreshPermissions: 'toph:refresh-permissions',
  sound: 'toph:sound',
  quit: 'toph:quit',
} as const;

export const DESKTOP_CAPTURE_IPC_CHANNELS = {
  start: 'toph:capture:start',
  stop: 'toph:capture:stop',
  started: 'toph:capture:started',
  stopped: 'toph:capture:stopped',
  chunk: 'toph:capture:chunk',
  error: 'toph:capture:error',
} as const;

// Shared because the main process owns the transparent Electron window while
// the renderer owns the visible overlay geometry and requests runtime resizes.
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

export type DictationPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'polishing'
  | 'no_speech'
  | 'failed';
export type PasteAttemptStatus = 'idle' | 'clipboard-only' | 'success' | 'failed';
export type SoundEventKind = 'start' | 'stop' | 'done';
export type ShortcutBackend = 'electron-global-shortcut' | 'gnome-custom-shortcut';
export type PermissionRequirementId = 'microphone' | 'accessibility';
export type ProviderId = 'openai-sub';
export const PROVIDER_IDS: readonly ProviderId[] = ['openai-sub'];
export const DEFAULT_AUTH_PROVIDER_ID: ProviderId = 'openai-sub';
export const DEFAULT_TRANSCRIPTION_PROVIDER_ID: ProviderId = 'openai-sub';
export const DEFAULT_INFERENCE_PROVIDER_ID: ProviderId = 'openai-sub';
export const DEFAULT_TRANSCRIPTION_MODEL = 'chatgpt-backend-transcribe';
export const DEFAULT_INFERENCE_MODEL = 'gpt-5.4-mini';
export const DEFAULT_POLISH_PROMPT_ID = 'default';
export type ProviderConnectionStatus = 'missing' | 'connecting' | 'connected' | 'invalid';
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
  kind: 'raw_concat' | 'polished';
  promptId: string | null;
  promptHash: string | null;
  createdAt: number;
  pasteStatus: PasteAttemptStatus;
  pasteDetail: string;
}

export interface PolishPromptSummary {
  id: string;
  title: string;
  bodyHash: string;
  isBuiltin: boolean;
}

export interface PolishState {
  prompts: PolishPromptSummary[];
}

export interface AppSettings {
  version: 1;
  auth: {
    providerId: ProviderId;
  };
  transcription: {
    providerId: ProviderId;
    model: string;
  };
  inference: {
    providerId: ProviderId;
    model: string;
  };
  polish: {
    enabled: boolean;
    promptId: string;
  };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  auth: {
    providerId: DEFAULT_AUTH_PROVIDER_ID,
  },
  transcription: {
    providerId: DEFAULT_TRANSCRIPTION_PROVIDER_ID,
    model: DEFAULT_TRANSCRIPTION_MODEL,
  },
  inference: {
    providerId: DEFAULT_INFERENCE_PROVIDER_ID,
    model: DEFAULT_INFERENCE_MODEL,
  },
  polish: {
    enabled: true,
    promptId: DEFAULT_POLISH_PROMPT_ID,
  },
};

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

export interface ProviderConnection {
  id: ProviderId;
  label: string;
  description: string;
  status: ProviderConnectionStatus;
  accountId: string | null;
  expires: number | null;
  error: string | null;
}

export interface ProviderState {
  ready: boolean;
  selectedProviderId: ProviderId | null;
  providers: ProviderConnection[];
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
  providers: ProviderState;
  settings: AppSettings;
  polish: PolishState;
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
  cancelCapture: () => Promise<void>;
  resizeOverlay: (size: OverlaySize) => Promise<void>;
  showSettings: () => Promise<void>;
  hideSettings: () => Promise<void>;
  installShortcut: (presetId: ShortcutPresetId) => Promise<void>;
  connectProvider: (providerId: ProviderId) => Promise<void>;
  submitProviderAuthorization: (providerId: ProviderId, input: string) => Promise<void>;
  removeProvider: (providerId: ProviderId) => Promise<void>;
  refreshProviders: () => Promise<void>;
  setAuthProvider: (providerId: ProviderId) => Promise<void>;
  setTranscriptionProvider: (providerId: ProviderId) => Promise<void>;
  setTranscriptionModel: (model: string) => Promise<void>;
  setInferenceProvider: (providerId: ProviderId) => Promise<void>;
  setInferenceModel: (model: string) => Promise<void>;
  setPolishEnabled: (enabled: boolean) => Promise<void>;
  setActivePolishPrompt: (promptId: string) => Promise<void>;
  performPermissionAction: (permissionId: PermissionRequirementId) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  onSoundEvent: (listener: (kind: SoundEventKind) => void) => () => void;
  quit: () => Promise<void>;
}

export interface OverlaySize {
  width: number;
  height: number;
}

export interface CaptureStartRequest {
  sessionId: string;
  sampleRate: number;
}

export interface CaptureChunkMessage {
  sessionId: string;
  chunk: ArrayBuffer;
}

export interface CaptureLifecycleMessage {
  sessionId: string;
}

export interface CaptureErrorMessage {
  sessionId: string | null;
  message: string;
}

export interface CaptureRendererApi {
  onStart: (listener: (request: CaptureStartRequest) => void) => () => void;
  onStop: (listener: () => void) => () => void;
  sendStarted: (message: CaptureLifecycleMessage) => void;
  sendStopped: (message: CaptureLifecycleMessage) => void;
  sendChunk: (message: CaptureChunkMessage) => void;
  sendError: (message: CaptureErrorMessage) => void;
}
