import { clipboard } from 'electron';

import type { PasteAttempt } from '@toph/desktop-contracts';

import type { ClipboardManager } from './managers/clipboard';
import type { WindowManager } from './managers/windows';
import type { DesktopStateStore } from './state';

export interface DictationController {
  toggleCapture: () => Promise<void>;
  dispose: () => void;
}

const toggleDebounceMs = 800;
const overlayHideDelayMs = 420;
const transcriptionDelayMs = 1300;
const mockTranscript = 'This is a mocked Toph dictation result. Real transcription plugs in next.';

function describeUnexpectedError(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${prefix} ${detail}.`;
}

export function createDictationController(options: {
  stateStore: DesktopStateStore;
  clipboard: Pick<ClipboardManager, 'pasteFromClipboard'>;
  ensurePermissionsReady: () => Promise<boolean>;
  windows: Pick<WindowManager, 'showSettings' | 'showOverlay' | 'hideOverlay' | 'emitSound'>;
}): DictationController {
  let transcribeTimer: ReturnType<typeof setTimeout> | null = null;
  let hideOverlayTimer: ReturnType<typeof setTimeout> | null = null;
  let lastToggleRequestAt = 0;

  const clearTranscribeTimer = () => {
    if (!transcribeTimer) {
      return;
    }

    clearTimeout(transcribeTimer);
    transcribeTimer = null;
  };

  const clearHideOverlayTimer = () => {
    if (!hideOverlayTimer) {
      return;
    }

    clearTimeout(hideOverlayTimer);
    hideOverlayTimer = null;
  };

  const finalizeTranscription = async () => {
    const transcript = mockTranscript;
    let pasteAttempt: PasteAttempt;

    try {
      clipboard.writeText(transcript);
      pasteAttempt = await options.clipboard.pasteFromClipboard();
    } catch (error) {
      pasteAttempt = {
        helper: null,
        status: 'failed',
        detail: describeUnexpectedError(
          'Transcript copied to the clipboard, but automatic paste failed unexpectedly.',
          error,
        ),
      };
    }

    options.stateStore.completeTranscription(transcript, pasteAttempt);
    options.windows.emitSound('done');
    clearHideOverlayTimer();
    hideOverlayTimer = setTimeout(() => {
      options.windows.hideOverlay();
      hideOverlayTimer = null;
    }, overlayHideDelayMs);
  };

  const beginListening = async () => {
    clearTranscribeTimer();
    clearHideOverlayTimer();
    options.stateStore.startListening();
    options.windows.showOverlay();
    options.windows.emitSound('start');
  };

  const finishListening = async () => {
    options.stateStore.startTranscribing();
    options.windows.emitSound('stop');
    clearTranscribeTimer();
    transcribeTimer = setTimeout(() => {
      transcribeTimer = null;
      void finalizeTranscription();
    }, transcriptionDelayMs);
  };

  return {
    async toggleCapture() {
      const now = Date.now();
      if (now - lastToggleRequestAt < toggleDebounceMs) {
        return;
      }

      lastToggleRequestAt = now;

      const { phase } = options.stateStore.getState();
      if (phase === 'idle') {
        if (!(await options.ensurePermissionsReady())) {
          return;
        }

        await beginListening();
        return;
      }

      if (phase === 'listening') {
        await finishListening();
      }
    },

    dispose() {
      clearTranscribeTimer();
      clearHideOverlayTimer();
    },
  };
}
