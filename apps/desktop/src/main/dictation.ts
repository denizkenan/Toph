import type { RawAudioRecorder } from './managers/audio-recorder';
import type { ClipboardManager } from './managers/clipboard';
import type { WindowManager } from './managers/windows';
import type { SessionOutputService } from './outputs/session-output-service';
import type { PolishService } from './polish/polish-service';
import type { SessionSegmentationService } from './segmentation/session-segmentation-service';
import type { SegmentationPipelineSession } from './segmentation/streaming/segmentation-pipeline-session';
import type { AppSettingsStore } from './settings/app-settings-store';
import type { DesktopStateStore } from './state';
import type { RecordingSessionStore } from './stores/session-store';
import type { SessionTranscriptionCoordinator } from './transcription/session-transcription-coordinator';

export interface DictationController {
  toggleCapture: () => Promise<void>;
  cancelCapture: () => Promise<void>;
  dispose: () => Promise<void>;
}

const toggleDebounceMs = 800;
const failureVisibleMs = 2_000;
const noSpeechVisibleMs = 2_000;
const maxLiveProcessingBacklog = 100;
type DictationLifecycle = 'idle' | 'starting' | 'listening' | 'stopping' | 'cancelling';

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
    | 'markPolishing'
    | 'markNoSpeech'
    | 'markFailed'
    | 'markRecordingFailed'
    | 'markCancelled'
    | 'markRecordedWithProcessingError'
    | 'setProcessingError'
    | 'clearSegmentationData'
    | 'discardSessionArtifacts'
    | 'pruneRetainedSessions'
  >;
  segmentation: SessionSegmentationService;
  transcription: SessionTranscriptionCoordinator;
  outputs: SessionOutputService;
  polish: PolishService;
  settingsStore: Pick<AppSettingsStore, 'getSettings'>;
  audioRecorder: RawAudioRecorder;
  clipboard: ClipboardManager;
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
  let activeOperationGeneration = 0;
  let activeRecorderStop: Promise<Awaited<ReturnType<RawAudioRecorder['stop']>>> | null = null;
  let activeFinishTask: Promise<void> | null = null;
  let lifecycle: DictationLifecycle = 'idle';
  let activePolishAbortController: AbortController | null = null;

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
          errorMessage: describeUnexpectedError(
            'Live segmentation could not finish unexpectedly.',
            error,
          ),
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

  const isCurrentOperation = (generation: number) => generation === activeOperationGeneration;

  const stopActiveRecorder = () => {
    activeRecorderStop ??= options.audioRecorder.stop().finally(() => {
      activeRecorderStop = null;
    });
    return activeRecorderStop;
  };

  const runFinishListening = () => {
    activeFinishTask ??= finishListening().finally(() => {
      activeFinishTask = null;
    });
    return activeFinishTask;
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
    liveProcessingErrorMessage = null;
    activeOperationGeneration += 1;
    const operationGeneration = activeOperationGeneration;

    const cancelStartedSession = async (
      session: { id: string },
      pipeline?: SegmentationPipelineSession | null,
      durationMs?: number,
    ) => {
      activeSession = null;
      activeLivePipeline = null;
      liveProcessingErrorMessage = null;
      liveProcessingQueue = Promise.resolve();
      liveProcessingBacklog = 0;
      await pipeline?.dispose();

      try {
        await options.transcription.cancelSession(session.id);
        await options.sessionStore.markCancelled({ sessionId: session.id, durationMs });
        await options.sessionStore.discardSessionArtifacts(session.id);
      } catch (error) {
        console.error('Toph could not persist the cancelled recording session.', error);
      } finally {
        lifecycle = 'idle';
        options.stateStore.setPhase('idle');
      }
    };

    try {
      const session = await options.sessionStore.createRecordingSession();
      if (!isCurrentOperation(operationGeneration)) {
        await cancelStartedSession(session);
        return;
      }

      liveProcessingGeneration += 1;
      const sessionGeneration = liveProcessingGeneration;
      activeSession = {
        id: session.id,
        rawAudioPath: session.rawAudioPath,
      };

      try {
        const pipeline = await options.segmentation.createLiveSession({
          sessionId: session.id,
          rawAudioPath: session.rawAudioPath,
          generateBatchAudio: true,
          onBatchesReady: async (batches) => {
            await Promise.all(batches.map((batch) => options.transcription.onBatchReady(batch.id)));
          },
        });
        if (!isCurrentOperation(operationGeneration)) {
          await cancelStartedSession(session, pipeline);
          return;
        }

        activeLivePipeline = pipeline;
      } catch (error) {
        liveProcessingErrorMessage = describeUnexpectedError(
          'Live segmentation could not start unexpectedly.',
          error,
        );
        console.error(liveProcessingErrorMessage, error);
        await options.sessionStore.setProcessingError({
          sessionId: session.id,
          errorMessage: liveProcessingErrorMessage,
        });
        if (!isCurrentOperation(operationGeneration)) {
          await cancelStartedSession(session);
          return;
        }
      }

      await options.audioRecorder.start({
        sessionId: session.id,
        outputPath: session.rawAudioPath,
        onPcmChunk: async (chunk) => {
          const generation = sessionGeneration;
          const pipelineAtEnqueue = activeLivePipeline;
          if (
            generation !== liveProcessingGeneration ||
            liveProcessingErrorMessage ||
            !activeLivePipeline
          ) {
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
          liveProcessingQueue = liveProcessingQueue
            .then(async () => {
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
                if (
                  generation !== liveProcessingGeneration ||
                  pipelineAtEnqueue !== activeLivePipeline
                ) {
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
            })
            .finally(() => {
              if (generation === liveProcessingGeneration) {
                liveProcessingBacklog -= 1;
              }
            });
          await liveProcessingQueue;
        },
      });
      if (!isCurrentOperation(operationGeneration)) {
        let stoppedRecordingDurationMs: number | undefined;
        try {
          stoppedRecordingDurationMs = (await stopActiveRecorder()).durationMs;
        } catch (error) {
          console.error('Toph could not stop the started recording while cancelling.', error);
        }

        await cancelStartedSession(session, activeLivePipeline, stoppedRecordingDurationMs);
        return;
      }

      lifecycle = 'listening';
      options.stateStore.startListening();
      options.windows.showOverlay();
      options.windows.emitSound('start');
    } catch (error) {
      if (!isCurrentOperation(operationGeneration)) {
        if (activeSession) {
          await cancelStartedSession(activeSession, activeLivePipeline);
        }

        lifecycle = 'idle';
        return;
      }

      await failActiveSession('Recording could not start unexpectedly.', error);
    }
  };

  const finishListening = async () => {
    const operationGeneration = activeOperationGeneration;
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
      const recording = await stopActiveRecorder();
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      await liveProcessingQueue;
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      const endedAt = Date.now();
      const pipeline = activeLivePipeline;

      await options.sessionStore.markRecorded({
        sessionId: session.id,
        endedAt,
        durationMs: recording.durationMs,
      });
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

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
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      await pipeline.dispose();
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      activeLivePipeline = null;
      liveProcessingQueue = Promise.resolve();
      liveProcessingBacklog = 0;
      liveProcessingGeneration += 1;

      await pruneSessions();
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      if (outcome.result === 'no_speech') {
        await options.sessionStore.markNoSpeech(session.id);
        activeSession = null;
        lifecycle = 'idle';
        await completeNoSpeechRecording();
        return;
      }

      await options.sessionStore.markSegmented(session.id);
      const transcriptionOutcome = await options.transcription.waitForSession(session.id);
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

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

      let rawOutput: Awaited<ReturnType<SessionOutputService['createRawConcatOutput']>>;
      try {
        rawOutput = await options.outputs.createRawConcatOutput(session.id);
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }
      } catch (error) {
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }

        const errorMessage = describeUnexpectedError(
          'Raw transcript assembly failed unexpectedly.',
          error,
        );
        await options.sessionStore.setProcessingError({ sessionId: session.id, errorMessage });
        activeSession = null;
        lifecycle = 'idle';
        options.stateStore.failDictation(errorMessage);
        options.windows.showOverlay();
        returnToIdleAfterFailure();
        return;
      }

      const polishSettings = options.settingsStore.getSettings().polish;
      if (!polishSettings.enabled) {
        await options.outputs.selectOutput({ sessionId: session.id, outputId: rawOutput.id });
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }

        const pasteAttempt = await options.clipboard.copyAndPasteText(rawOutput.text);
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }

        options.stateStore.completeTranscription(rawOutput.text, pasteAttempt, {
          id: rawOutput.id,
          createdAt: rawOutput.createdAt,
          kind: 'raw_concat',
        });
        activeSession = null;
        lifecycle = 'idle';
        options.windows.emitSound('done');
        return;
      }

      let polishedOutput: Awaited<ReturnType<PolishService['polishOutput']>>;
      try {
        await options.sessionStore.markPolishing(session.id);
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }

        options.stateStore.startPolishing();
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }

        activePolishAbortController = new AbortController();
        polishedOutput = await options.polish.polishOutput({
          sessionId: session.id,
          rawOutput,
          signal: activePolishAbortController.signal,
        });
        activePolishAbortController = null;
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }

        await options.outputs.selectOutput({ sessionId: session.id, outputId: polishedOutput.id });
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }
      } catch (error) {
        activePolishAbortController = null;
        if (!isCurrentOperation(operationGeneration)) {
          return;
        }

        const errorMessage = describeUnexpectedError('Polish failed unexpectedly.', error);
        await options.sessionStore.markFailed({ sessionId: session.id, errorMessage });
        activeSession = null;
        lifecycle = 'idle';
        options.stateStore.failDictation(errorMessage);
        options.windows.showOverlay();
        returnToIdleAfterFailure();
        return;
      }

      const pasteAttempt = await options.clipboard.copyAndPasteText(polishedOutput.text);
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

      options.stateStore.completeTranscription(polishedOutput.text, pasteAttempt, {
        id: polishedOutput.id,
        createdAt: polishedOutput.createdAt,
        kind: 'polished',
        rulePresetId: polishedOutput.rulePresetId,
        rulePresetHash: polishedOutput.rulePresetHash,
      });
      activeSession = null;
      lifecycle = 'idle';
      options.windows.emitSound('done');
    } catch (error) {
      activePolishAbortController = null;
      if (!isCurrentOperation(operationGeneration)) {
        return;
      }

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

      const { phase, ruleSwitcher } = options.stateStore.getState();
      if (ruleSwitcher.mode !== 'idle') {
        return;
      }

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
        await runFinishListening();
      }
    },

    async cancelCapture() {
      clearFailureTimer();
      clearNoSpeechTimer();

      const previousLifecycle = lifecycle;
      const session = activeSession;
      const pipeline = activeLivePipeline;
      const pendingLiveProcessing = liveProcessingQueue;
      const pendingFinish = activeFinishTask;
      const shouldStopRecorder =
        lifecycle === 'starting' || lifecycle === 'listening' || Boolean(activeRecorderStop);
      activePolishAbortController?.abort();
      activePolishAbortController = null;
      activeOperationGeneration += 1;
      lifecycle = 'cancelling';
      options.stateStore.setPhase('idle');
      options.windows.showOverlay();

      if (previousLifecycle === 'starting' || previousLifecycle === 'cancelling') {
        return;
      }

      activeSession = null;
      activeLivePipeline = null;
      liveProcessingErrorMessage = null;
      liveProcessingQueue = Promise.resolve();
      liveProcessingBacklog = 0;
      liveProcessingGeneration += 1;

      if (!session) {
        lifecycle = 'idle';
        return;
      }

      let stoppedRecordingDurationMs: number | undefined;
      if (shouldStopRecorder) {
        try {
          stoppedRecordingDurationMs = (await stopActiveRecorder()).durationMs;
        } catch (error) {
          console.error('Toph could not stop the active recording while cancelling.', error);
        }
      }

      await pendingLiveProcessing.catch((queueError: unknown) => {
        console.error('Toph live segmentation queue failed while cancelling.', queueError);
      });

      try {
        // A flush may schedule batches while cancel is waiting for finish cleanup;
        // cancel both sides of that wait so no transcriptions survive cancellation.
        await options.transcription.cancelSession(session.id);
        await pendingFinish?.catch((finishError: unknown) => {
          console.error('Toph finishing pipeline failed while cancelling.', finishError);
        });
        await options.transcription.cancelSession(session.id);
        await pipeline?.dispose();
        await options.sessionStore.markCancelled({
          sessionId: session.id,
          durationMs: stoppedRecordingDurationMs,
        });
        await options.sessionStore.discardSessionArtifacts(session.id);
      } catch (error) {
        console.error('Toph could not persist the cancelled recording session.', error);
      } finally {
        lifecycle = 'idle';
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
      activeOperationGeneration += 1;
      lifecycle = 'idle';
      activePolishAbortController?.abort();
      activePolishAbortController = null;
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
