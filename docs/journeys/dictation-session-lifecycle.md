# Dictation Session Lifecycle

## Purpose

This document describes the end-to-end lifecycle of one dictation session from the user's perspective and the system's perspective.

## Happy Path

The happy path is:

```text
User toggles dictation on
  -> app creates a session
  -> app starts raw audio recording
  -> app detects speech and silence
  -> app creates live batches when boundaries are safe
  -> app transcribes batches while recording continues
User toggles dictation off
  -> app stops raw audio recording
  -> app flushes the remaining batch
  -> app waits for required batch transcripts
  -> app assembles raw transcript text
  -> app optionally post-processes final text
  -> app stores the selected session output
  -> app can paste the selected output
```

The user experiences this as one session, even if the app created several provider batches internally.

## Short Session Under 10 Seconds

If the user stops before the preferred minimum upload duration, the app should still flush and transcribe the remaining audio.

This accepts provider billing inefficiency because the user explicitly ended the session. Waiting for more speech after the user stops would be worse product behavior.

Expected behavior:

- Store the full raw session.
- Create one final short batch.
- Transcribe it.
- Assemble and optionally post-process the result.

## Long Thinking Pause

A user may pause for several seconds while thinking, with listening still active.

The raw audio should keep the full silence because it is the source of truth.

The derived provider audio should include only a short preserved pause range from the long silence. This keeps the transcript audio natural without sending a long thinking gap.

Expected behavior:

- Store the full raw silence in `raw.wav`.
- Store the silence as a timeline region.
- Include only a small source slice from that silence in the batch source ranges.
- Regenerate derived debug audio from those ranges if needed.

## Continuous Speech Without Pauses

If the user speaks continuously, the MVP should not force-cut in the middle of speech.

The batch may exceed the target duration until one of these happens:

- a safe pause boundary appears,
- the user stops the session.

This prioritizes not clipping words over strict adherence to target batch duration.

## Provider Failure

A transcription provider request can fail while recording continues or after the user stops.

Expected behavior:

- Mark the batch as failed.
- Store the error detail.
- Keep the raw audio, timeline regions, batch row, and source ranges.
- Surface enough state for retry or debugging.
- Do not lose the rest of the session's successful transcript data.

The session should not silently pretend to be complete if a required batch failed.

## Reprocessing A Session

Reprocessing should be possible because the raw audio and segmentation data are persisted.

When reprocessing:

- Reuse existing timeline regions if present and still valid.
- Re-run VAD only if no segmentation data exists or if the user explicitly requests resegmentation.
- Regenerate derived batch files on demand from raw audio and batch source ranges.
- Create new transcripts or session outputs without mutating raw audio.

Reprocessing should preserve provenance. A new output should record whether it was created by raw concatenation, post-processing, or a future manual regeneration flow.
