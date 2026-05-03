import {
  DEFAULT_SHORTCUT_PRESET,
  resolveShortcutPresetForPlatform,
  type AppState,
  type DictationPhase,
  type PasteAttempt,
  type PasteSupport,
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
  setPasteSupport: (pasteSupport: PasteSupport) => void;
  setPhase: (phase: DictationPhase) => void;
  startListening: () => void;
  startTranscribing: () => void;
  completeTranscription: (transcript: string, pasteAttempt: PasteAttempt) => void;
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

    setPasteSupport(pasteSupport) {
      commit((draft) => {
        draft.pasteSupport = pasteSupport;
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
          detail: 'Listening for mock speech input...',
        };
      });
    },

    startTranscribing() {
      commit((draft) => {
        draft.phase = 'transcribing';
        draft.lastPasteAttempt = {
          helper: draft.lastPasteAttempt.helper,
          status: 'idle',
          detail: 'Mock transcription is underway...',
        };
      });
    },

    completeTranscription(transcript, pasteAttempt) {
      commit((draft) => {
        const createdAt = Date.now();
        const nextConversion = {
          id: `${createdAt}`,
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
