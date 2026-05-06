import type { RawAudioRecorder } from './managers/audio-recorder';
import type { WindowManager } from './managers/windows';
import type { DesktopStateStore } from './state';
import type { RecordingSessionStore } from './stores/session-store';

export interface DictationController {
  toggleCapture: () => Promise<void>;
  dispose: () => Promise<void>;
}

const toggleDebounceMs = 800;
const recordingCompleteDelayMs = 500;
const failureVisibleMs = 2_000;
type DictationLifecycle = 'idle' | 'starting' | 'listening' | 'stopping';

function describeUnexpectedError(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${prefix} ${detail}.`;
}

export function createDictationController(options: {
  stateStore: DesktopStateStore;
  sessionStore: Pick<
    RecordingSessionStore,
    'createRecordingSession' | 'markRecorded' | 'markFailed' | 'pruneRetainedSessions'
  >;
  audioRecorder: RawAudioRecorder;
  ensurePermissionsReady: () => Promise<boolean>;
  windows: Pick<WindowManager, 'showOverlay' | 'emitSound'>;
}): DictationController {
  let failureTimer: ReturnType<typeof setTimeout> | null = null;
  let lastToggleRequestAt = 0;
  let activeSession: { id: string; rawAudioPath: string } | null = null;
  let lifecycle: DictationLifecycle = 'idle';

  const clearFailureTimer = () => {
    if (!failureTimer) {
      return;
    }

    clearTimeout(failureTimer);
    failureTimer = null;
  };

  const returnToIdleAfterFailure = () => {
    clearFailureTimer();
    failureTimer = setTimeout(() => {
      failureTimer = null;
      options.stateStore.setPhase('idle');
    }, failureVisibleMs);
  };

  const failActiveSession = async (detail: string, error: unknown) => {
    const message = describeUnexpectedError(detail, error);
    const failedSession = activeSession;
    activeSession = null;
    lifecycle = 'idle';

    if (failedSession) {
      try {
        await options.sessionStore.markFailed({
          sessionId: failedSession.id,
          errorMessage: message,
        });
      } catch (markError) {
        console.error('Toph could not mark the recording session as failed.', markError);
      }
    }

    console.error(message, error);
    options.stateStore.failDictation(message);
    options.windows.showOverlay();
    await pruneSessions();
    returnToIdleAfterFailure();
  };

  const completeRecording = async () => {
    await new Promise((resolve) => setTimeout(resolve, recordingCompleteDelayMs));
    options.stateStore.completeRecording();
    options.windows.emitSound('done');
  };

  const pruneSessions = async () => {
    try {
      await options.sessionStore.pruneRetainedSessions();
    } catch (error) {
      console.error('Toph could not prune old recording sessions.', error);
    }
  };

  const beginListening = async () => {
    clearFailureTimer();

    try {
      const session = await options.sessionStore.createRecordingSession();
      activeSession = {
        id: session.id,
        rawAudioPath: session.rawAudioPath,
      };

      await options.audioRecorder.start({
        sessionId: session.id,
        outputPath: session.rawAudioPath,
      });
      lifecycle = 'listening';
      options.stateStore.startListening();
      options.windows.showOverlay();
      options.windows.emitSound('start');
    } catch (error) {
      await failActiveSession('Recording could not start unexpectedly.', error);
    }
  };

  const finishListening = async () => {
    const session = activeSession;
    if (!session) {
      lifecycle = 'idle';
      options.stateStore.setPhase('idle');
      return;
    }

    options.stateStore.startTranscribing();
    options.windows.emitSound('stop');

    try {
      const recording = await options.audioRecorder.stop();
      const endedAt = Date.now();

      await options.sessionStore.markRecorded({
        sessionId: session.id,
        endedAt,
        durationMs: recording.durationMs,
      });

      activeSession = null;
      lifecycle = 'idle';
      await pruneSessions();
      await completeRecording();
    } catch (error) {
      await failActiveSession('Recording could not finish unexpectedly.', error);
    }
  };

  return {
    async toggleCapture() {
      const now = Date.now();
      if (now - lastToggleRequestAt < toggleDebounceMs) {
        return;
      }

      lastToggleRequestAt = now;

      const { phase } = options.stateStore.getState();
      if (lifecycle === 'idle' && phase === 'idle') {
        if (!(await options.ensurePermissionsReady())) {
          return;
        }

        lifecycle = 'starting';
        await beginListening();
        return;
      }

      if (lifecycle === 'listening' && phase === 'listening') {
        lifecycle = 'stopping';
        await finishListening();
      }
    },

    async dispose() {
      clearFailureTimer();
      const session = activeSession;
      activeSession = null;
      lifecycle = 'idle';
      options.audioRecorder.dispose();

      if (session) {
        try {
          await options.sessionStore.markFailed({
            sessionId: session.id,
            errorMessage: 'Recording was interrupted because Toph is quitting.',
          });
          await pruneSessions();
        } catch (error) {
          console.error('Toph could not fail the active recording session during shutdown.', error);
        }
      }
    },
  };
}
