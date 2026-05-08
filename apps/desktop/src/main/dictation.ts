import type { RawAudioRecorder } from './managers/audio-recorder';
import type { WindowManager } from './managers/windows';
import type { SessionOutputService } from './outputs/session-output-service';
import type { SessionSegmentationService } from './segmentation/session-segmentation-service';
import type { SegmentationPipelineSession } from './segmentation/streaming/segmentation-pipeline-session';
import type { DesktopStateStore } from './state';
import type { RecordingSessionStore } from './stores/session-store';
import type { SessionTranscriptionCoordinator } from './transcription/session-transcription-coordinator';

export interface DictationController {
  toggleCapture: () => Promise<void>;
  dispose: () => Promise<void>;
}

const toggleDebounceMs = 800;
const failureVisibleMs = 2_000;
const noSpeechVisibleMs = 2_000;
const maxLiveProcessingBacklog = 100;
type DictationLifecycle = 'idle' | 'starting' | 'listening' | 'stopping';

function describeUnexpectedError(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${prefix} ${detail}.`;
}

export function createDictationController(options: {
  stateStore: DesktopStateStore;
  sessionStore: Pick<
    RecordingSessionStore,
    | 'createRecordingSession'
    | 'markRecorded'
    | 'markSegmented'
    | 'markNoSpeech'
    | 'markRecordingFailed'
    | 'markRecordedWithProcessingError'
    | 'setProcessingError'
    | 'clearSegmentationData'
    | 'pruneRetainedSessions'
  >;
  segmentation: SessionSegmentationService;
  transcription: SessionTranscriptionCoordinator;
  outputs: SessionOutputService;
  audioRecorder: RawAudioRecorder;
  ensurePermissionsReady: () => Promise<boolean>;
  windows: Pick<WindowManager, 'showOverlay' | 'emitSound'>;
}): DictationController {
  let failureTimer: ReturnType<typeof setTimeout> | null = null;
  let noSpeechTimer: ReturnType<typeof setTimeout> | null = null;
  let lastToggleRequestAt = 0;
  let activeSession: { id: string; rawAudioPath: string } | null = null;
  let activeLivePipeline: SegmentationPipelineSession | null = null;
  let liveProcessingErrorMessage: string | null = null;
  let liveProcessingQueue: Promise<void> = Promise.resolve();
  let liveProcessingBacklog = 0;
  let liveProcessingGeneration = 0;
  let lifecycle: DictationLifecycle = 'idle';

  const clearFailureTimer = () => {
    if (!failureTimer) {
      return;
    }

    clearTimeout(failureTimer);
    failureTimer = null;
  };

  const clearNoSpeechTimer = () => {
    if (!noSpeechTimer) {
      return;
    }

    clearTimeout(noSpeechTimer);
    noSpeechTimer = null;
  };

  const returnToIdleAfterFailure = () => {
    clearFailureTimer();
    failureTimer = setTimeout(() => {
      failureTimer = null;
      options.stateStore.setPhase('idle');
    }, failureVisibleMs);
  };

  const returnToIdleAfterNoSpeech = () => {
    clearNoSpeechTimer();
    noSpeechTimer = setTimeout(() => {
      noSpeechTimer = null;
      options.stateStore.setPhase('idle');
    }, noSpeechVisibleMs);
  };

  const failProcessedSession = async (error: unknown) => {
    const session = activeSession;
    const pipeline = activeLivePipeline;
    if (session) {
      try {
        await options.sessionStore.markRecordedWithProcessingError({
          sessionId: session.id,
          errorMessage: describeUnexpectedError('Live segmentation could not finish unexpectedly.', error),
        });
        await options.transcription.cancelSession(session.id);
        await options.sessionStore.clearSegmentationData(session.id);
      } catch (markError) {
        console.error('Toph could not persist the live segmentation failure.', markError);
      }
    }

    activeSession = null;
    activeLivePipeline = null;
    liveProcessingErrorMessage = null;
    liveProcessingQueue = Promise.resolve();
    liveProcessingBacklog = 0;
    liveProcessingGeneration += 1;
    lifecycle = 'idle';
    await pipeline?.dispose();
    console.error('Toph could not complete live segmentation for the recording session.', error);
    options.stateStore.failDictation('Unable to transcribe.');
    options.windows.showOverlay();
    await pruneSessions();
    returnToIdleAfterFailure();
  };

  const failActiveSession = async (detail: string, error: unknown) => {
    const message = describeUnexpectedError(detail, error);
    const failedSession = activeSession;
    const failedPipeline = activeLivePipeline;
    const pendingLiveProcessing = liveProcessingQueue;
    activeSession = null;
    activeLivePipeline = null;
    liveProcessingErrorMessage = null;
    liveProcessingQueue = Promise.resolve();
    liveProcessingBacklog = 0;
    liveProcessingGeneration += 1;
    lifecycle = 'idle';

    await pendingLiveProcessing.catch((queueError: unknown) => {
      console.error('Toph live segmentation queue failed while recording was failing.', queueError);
    });
    await failedPipeline?.dispose();

    if (failedSession) {
      try {
        await options.sessionStore.markRecordingFailed({
          sessionId: failedSession.id,
          errorMessage: message,
        });
        await options.transcription.cancelSession(failedSession.id);
        await options.sessionStore.clearSegmentationData(failedSession.id);
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

  const completeNoSpeechRecording = async () => {
    options.stateStore.noSpeechDetected();
    options.windows.showOverlay();
    options.windows.emitSound('done');
    returnToIdleAfterNoSpeech();
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
    clearNoSpeechTimer();

    try {
      const session = await options.sessionStore.createRecordingSession();
      liveProcessingGeneration += 1;
      const sessionGeneration = liveProcessingGeneration;
      activeSession = {
        id: session.id,
        rawAudioPath: session.rawAudioPath,
      };

      try {
        activeLivePipeline = await options.segmentation.createLiveSession({
          sessionId: session.id,
          rawAudioPath: session.rawAudioPath,
          generateBatchAudio: true,
          onBatchesReady: async (batches) => {
            await Promise.all(batches.map((batch) => options.transcription.onBatchReady(batch.id)));
          },
        });
      } catch (error) {
        liveProcessingErrorMessage = describeUnexpectedError('Live segmentation could not start unexpectedly.', error);
        console.error(liveProcessingErrorMessage, error);
        await options.sessionStore.setProcessingError({
          sessionId: session.id,
          errorMessage: liveProcessingErrorMessage,
        });
      }

      await options.audioRecorder.start({
        sessionId: session.id,
        outputPath: session.rawAudioPath,
        onPcmChunk: async (chunk) => {
          const generation = sessionGeneration;
          const pipelineAtEnqueue = activeLivePipeline;
          if (generation !== liveProcessingGeneration || liveProcessingErrorMessage || !activeLivePipeline) {
            return;
          }

          if (liveProcessingBacklog >= maxLiveProcessingBacklog) {
            const pipeline = activeLivePipeline;
            liveProcessingErrorMessage = 'Live segmentation fell behind recording and was stopped.';
            console.error(liveProcessingErrorMessage);
            activeLivePipeline = null;
            liveProcessingQueue = liveProcessingQueue.finally(async () => {
              await pipeline.dispose();
            });
            await options.sessionStore.setProcessingError({
              sessionId: session.id,
              errorMessage: liveProcessingErrorMessage,
            });
            return;
          }

          liveProcessingBacklog += 1;
          liveProcessingQueue = liveProcessingQueue.then(async () => {
            if (
              generation !== liveProcessingGeneration ||
              pipelineAtEnqueue !== activeLivePipeline ||
              !pipelineAtEnqueue ||
              liveProcessingErrorMessage
            ) {
              return;
            }

            try {
              await pipelineAtEnqueue.processPcmChunk(chunk);
            } catch (error) {
              if (generation !== liveProcessingGeneration || pipelineAtEnqueue !== activeLivePipeline) {
                return;
              }

              liveProcessingErrorMessage = describeUnexpectedError(
                'Live segmentation failed while recording.',
                error,
              );
              console.error(liveProcessingErrorMessage, error);
              activeLivePipeline = null;
              await pipelineAtEnqueue.dispose();
              await options.sessionStore.setProcessingError({
                sessionId: session.id,
                errorMessage: liveProcessingErrorMessage,
              });
            }
          }).finally(() => {
            if (generation === liveProcessingGeneration) {
              liveProcessingBacklog -= 1;
            }
          });
          await liveProcessingQueue;
        },
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
    let recordingWasSaved = false;

    try {
      const recording = await options.audioRecorder.stop();
      await liveProcessingQueue;
      const endedAt = Date.now();
      const pipeline = activeLivePipeline;

      await options.sessionStore.markRecorded({
        sessionId: session.id,
        endedAt,
        durationMs: recording.durationMs,
      });
      recordingWasSaved = true;

      if (liveProcessingErrorMessage || !pipeline) {
        const errorMessage = liveProcessingErrorMessage ?? 'Live segmentation did not start.';
        await options.sessionStore.setProcessingError({
          sessionId: session.id,
          errorMessage,
        });
        await options.transcription.cancelSession(session.id);
        await options.sessionStore.clearSegmentationData(session.id);
        await pipeline?.dispose();
        activeSession = null;
        activeLivePipeline = null;
        liveProcessingErrorMessage = null;
        liveProcessingQueue = Promise.resolve();
        liveProcessingBacklog = 0;
        liveProcessingGeneration += 1;
        lifecycle = 'idle';
        await pruneSessions();
        options.stateStore.failDictation(errorMessage);
        options.windows.showOverlay();
        returnToIdleAfterFailure();
        return;
      }

      const outcome = await pipeline.flush();
      await pipeline.dispose();
      activeLivePipeline = null;
      liveProcessingQueue = Promise.resolve();
      liveProcessingBacklog = 0;
      liveProcessingGeneration += 1;

      await pruneSessions();
      if (outcome.result === 'no_speech') {
        await options.sessionStore.markNoSpeech(session.id);
        activeSession = null;
        lifecycle = 'idle';
        await completeNoSpeechRecording();
        return;
      }

      await options.sessionStore.markSegmented(session.id);
      const transcriptionOutcome = await options.transcription.waitForSession(session.id);
      if (transcriptionOutcome.failedOrIncompleteBatchCount > 0) {
        const errorMessage = `${transcriptionOutcome.failedOrIncompleteBatchCount} transcription batch${transcriptionOutcome.failedOrIncompleteBatchCount === 1 ? '' : 'es'} failed or did not finish.`;
        await options.sessionStore.setProcessingError({ sessionId: session.id, errorMessage });
        activeSession = null;
        lifecycle = 'idle';
        options.stateStore.failDictation(errorMessage);
        options.windows.showOverlay();
        returnToIdleAfterFailure();
        return;
      }

      let output: Awaited<ReturnType<SessionOutputService['createRawConcatOutput']>>;
      try {
        output = await options.outputs.createRawConcatOutput(session.id);
      } catch (error) {
        const errorMessage = describeUnexpectedError('Raw transcript assembly failed unexpectedly.', error);
        await options.sessionStore.setProcessingError({ sessionId: session.id, errorMessage });
        activeSession = null;
        lifecycle = 'idle';
        options.stateStore.failDictation(errorMessage);
        options.windows.showOverlay();
        returnToIdleAfterFailure();
        return;
      }

      options.stateStore.completeTranscription(output.text, {
        helper: null,
        status: 'idle',
        detail: 'Raw transcript assembled. Auto-paste is not enabled yet.',
      }, { id: output.id, createdAt: output.createdAt });
      activeSession = null;
      lifecycle = 'idle';
      options.windows.emitSound('done');
    } catch (error) {
      if (recordingWasSaved) {
        await failProcessedSession(error);
        return;
      }

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
      clearNoSpeechTimer();
      const session = activeSession;
      const pipeline = activeLivePipeline;
      const pendingLiveProcessing = liveProcessingQueue;
      activeSession = null;
      activeLivePipeline = null;
      liveProcessingErrorMessage = null;
      liveProcessingQueue = Promise.resolve();
      liveProcessingBacklog = 0;
      liveProcessingGeneration += 1;
      lifecycle = 'idle';
      options.audioRecorder.dispose();
      await pendingLiveProcessing.catch((queueError: unknown) => {
        console.error('Toph live segmentation queue failed during shutdown.', queueError);
      });
      await pipeline?.dispose();

      if (session) {
        try {
          await options.sessionStore.markRecordingFailed({
            sessionId: session.id,
            errorMessage: 'Recording was interrupted because Toph is quitting.',
          });
          await options.transcription.cancelSession(session.id);
          await options.sessionStore.clearSegmentationData(session.id);
          await pruneSessions();
        } catch (error) {
          console.error('Toph could not fail the active recording session during shutdown.', error);
        }
      }
    },
  };
}
