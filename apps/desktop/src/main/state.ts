import {
  DEFAULT_SHORTCUT_PRESET,
  resolveShortcutPresetForPlatform,
  type AppState,
  type ConversionRecord,
  type DictationPhase,
  type PasteAttempt,
  type PasteSupport,
  type PermissionState,
  type ShortcutPreset,
} from '@toph/desktop-contracts';

export interface ShortcutStateSupport {
  backend: AppState['shortcut']['backend'];
  registered: boolean;
  installable: boolean;
  installed: boolean;
  detail: string;
}

export interface DesktopStateStore {
  getState: () => AppState;
  subscribe: (listener: (state: AppState) => void) => () => void;
  setShortcut: (preset: ShortcutPreset, support: ShortcutStateSupport) => void;
  setPermissions: (permissions: PermissionState) => void;
  setPasteSupport: (pasteSupport: PasteSupport) => void;
  setRecentConversions: (conversions: ConversionRecord[]) => void;
  setPhase: (phase: DictationPhase) => void;
  startListening: () => void;
  startTranscribing: () => void;
  completeRecording: () => void;
  noSpeechDetected: () => void;
  failDictation: (detail: string) => void;
  completeTranscription: (
    transcript: string,
    pasteAttempt: PasteAttempt,
    options?: { id?: string; createdAt?: number },
  ) => void;
}

function createInitialState(): AppState {
  const defaultShortcutPreset = resolveShortcutPresetForPlatform(
    DEFAULT_SHORTCUT_PRESET.id,
    process.platform,
  );

  return {
    phase: 'idle',
    shortcut: {
      presetId: defaultShortcutPreset.id,
      accelerator: defaultShortcutPreset.accelerator,
      label: defaultShortcutPreset.label,
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
    permissions: {
      ready: process.platform !== 'darwin',
      requirements: [],
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
}

export function createDesktopStateStore(): DesktopStateStore {
  const state = createInitialState();
  const listeners = new Set<(state: AppState) => void>();

  const publish = () => {
    state.updatedAt = Date.now();
    for (const listener of listeners) {
      listener(state);
    }
  };

  const commit = (update: (draft: AppState) => void) => {
    update(state);
    publish();
  };

  return {
    getState() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setShortcut(preset, support) {
      commit((draft) => {
        draft.shortcut = {
          presetId: preset.id,
          accelerator: preset.accelerator,
          label: preset.label,
          ...support,
        };
      });
    },

    setPermissions(permissions) {
      commit((draft) => {
        draft.permissions = permissions;
      });
    },

    setPasteSupport(pasteSupport) {
      commit((draft) => {
        draft.pasteSupport = pasteSupport;
      });
    },

    setRecentConversions(conversions) {
      commit((draft) => {
        draft.recentConversions = conversions.slice(0, 8);
        draft.lastTranscript = conversions[0]?.text ?? null;
      });
    },

    setPhase(phase) {
      commit((draft) => {
        draft.phase = phase;
      });
    },

    startListening() {
      commit((draft) => {
        draft.phase = 'listening';
        draft.lastPasteAttempt = {
          helper: draft.lastPasteAttempt.helper,
          status: 'idle',
          detail: 'Recording microphone audio...',
        };
      });
    },

    startTranscribing() {
      commit((draft) => {
        draft.phase = 'transcribing';
        draft.lastPasteAttempt = {
          helper: draft.lastPasteAttempt.helper,
          status: 'idle',
          detail: 'Processing recording...',
        };
      });
    },

    completeRecording() {
      commit((draft) => {
        draft.phase = 'idle';
        draft.lastPasteAttempt = {
          helper: draft.lastPasteAttempt.helper,
          status: 'idle',
          detail: 'Recording transcribed locally. Transcript assembly is not enabled yet.',
        };
      });
    },

    noSpeechDetected() {
      commit((draft) => {
        draft.phase = 'no_speech';
        draft.lastPasteAttempt = {
          helper: draft.lastPasteAttempt.helper,
          status: 'idle',
          detail: 'No speech detected.',
        };
      });
    },

    failDictation(detail) {
      commit((draft) => {
        draft.phase = 'failed';
        draft.lastPasteAttempt = {
          helper: draft.lastPasteAttempt.helper,
          status: 'failed',
          detail,
        };
      });
    },

    completeTranscription(transcript, pasteAttempt, options) {
      commit((draft) => {
        const createdAt = options?.createdAt ?? Date.now();
        const nextConversion = {
          id: options?.id ?? `${createdAt}`,
          text: transcript,
          createdAt,
          pasteStatus: pasteAttempt.status,
          pasteDetail: pasteAttempt.detail,
        };

        draft.phase = 'idle';
        draft.lastTranscript = transcript;
        draft.lastPasteAttempt = pasteAttempt;
        draft.recentConversions = [nextConversion, ...draft.recentConversions].slice(0, 8);
      });
    },
  };
}
