# Real Dictation Architecture

## Purpose

This document describes the target architecture for Toph's real dictation functionality. It explains how raw recording, speech/silence analysis, batching, transcription, transcript assembly, post-processing, and output delivery fit together.

The architecture should support both live processing while recording is active and offline reprocessing after a complete raw recording already exists.

## Goals

- Record one full raw session per toggle-on/toggle-off interval.
- Store only the last 10 sessions by default.
- Preserve raw audio unchanged.
- Derive transcription batches from speech/silence analysis.
- Prefer transcription batches above provider billing minimums when the user keeps speaking.
- Start transcription during recording once live batches are finalized.
- Run post-processing only after the session is complete and all batch transcripts are available.
- Keep transcription providers replaceable so the app is not hardcoded around one vendor.

## Non-Goals For The Initial Implementation

- Do not aggressively remove every silence.
- Do not mutate or trim the raw recording.
- Do not force-cut continuous speech in the MVP.
- Do not add advanced noise suppression initially; rely on microphone quality and basic capture behavior until transcription quality proves otherwise.
- Do not require a real-time streaming transcription API.
- Do not store derived batch audio permanently by default.
- Do not invest in a broad test suite while the architecture is still changing.

## System Components

### Dictation Controller

Owns the user-facing recording lifecycle. It reacts to toggle requests, starts and stops sessions, coordinates collaborators, and updates app state.

The current mock orchestration lives in `apps/desktop/src/main/dictation.ts`. Real recording should grow from that orchestration point rather than leaking audio or provider behavior into the renderer.

### Recording Session Store

Owns local persistence for sessions, timeline regions, transcription batches, batch source ranges, batch transcripts, and final session outputs.

The durable local store should use SQLite at `~/.toph/data.db` unless implementation discovers unacceptable Electron packaging friction.

### Raw Audio Recorder

Captures one raw WAV file for each session. The raw file is the source of truth and should be preserved unchanged.

Raw recordings should live under:

```text
~/.toph/recordings/<sessionId>/raw.wav
```

### VAD / Timeline Analyzer

VAD means Voice Activity Detection.

Detects speech and silence regions over the raw audio. It should produce timestamped timeline regions that can be stored and reused.

The analyzer should work in two modes:

- Offline mode: analyze a complete raw recording.
- Live mode: incrementally analyze audio while recording is active.

### Batch Planner

Decides when enough usable audio has accumulated to create a transcription batch. It should use timeline regions rather than raw wall-clock duration alone.

The planner should prefer pause boundaries and avoid force-cutting active speech in the MVP.

### Derived Clip Generator

Creates provider upload audio from raw audio and batch source ranges. It should not modify the raw file.

Long silence is shortened by selecting only a small preserved slice from the raw silence region. The system does not need to synthesize silence for the initial design.

### Transcription Queue

Receives finalized batches and processes them through a transcription provider while recording may still be active.

The queue must make batch status explicit enough to retry failed batches and avoid duplicate work.

### Transcription Provider Abstraction

Defines the boundary between Toph and a speech-to-text provider. Initial candidates are OpenAI and Groq.

Provider choice should not leak into the session, batch, transcript, or post-processing data model.

### Transcript Assembler

Combines raw batch transcripts in batch sequence order after all session batches are transcribed or after the session reaches a recoverable failure state.

The first durable session output can be a raw concatenation of batch transcripts.

### Post-Processing Provider

Runs after the session is complete and all batch transcripts are available. It turns the assembled transcript into cleaner user-facing text.

Use the term post-processing for this layer. Avoid calling it normalization in new docs and APIs unless the implementation later introduces a narrower normalization sub-step.

### Paste / Output Layer

Handles final delivery into the active field. Paste behavior is secondary to the recording, batching, transcription, and post-processing pipeline because the current app already proves clipboard/paste capability.

## End-State Runtime Flow

The intended final runtime flow is:

```text
User toggles dictation on
  -> create recording session
  -> start raw WAV recording
  -> run VAD and append timeline regions
  -> finalize live batches at safe pause boundaries
  -> queue finalized batches for transcription
  -> continue recording while transcription runs
User toggles dictation off
  -> stop raw WAV recording
  -> flush remaining batch, even if under preferred duration
  -> wait for batch transcriptions or surface failures
  -> assemble raw transcript
  -> optionally run post-processing
  -> store final output
  -> optionally paste final output
  -> prune sessions beyond retention policy
```

## Live And Offline Processing Share One Pipeline

Live and offline processing should use the same concepts and planner semantics.

Offline processing receives a complete raw recording and can analyze the whole file before planning batches. This is easier to debug and should be implemented before live batching.

Live processing receives partial audio and incrementally appends timeline regions. It should track which source ranges have already been emitted into finalized batches so it does not duplicate or miss audio.

The live planner should be equivalent to the offline planner for the same timeline whenever possible. Some differences are acceptable because live mode cannot see the future, but those differences should be explicit.

## Pause Handling Policy

A soft pause is a likely phrase or batch boundary. It is useful when enough derived audio has accumulated to create a cost-efficient batch.

A hard pause is a longer thinking gap. It is a stronger boundary and a candidate for silence shortening, but it should not force a tiny batch unless the user stops the session.

Long silence should be shortened to a small preserved pause, not fully erased. This keeps speech natural while removing extended periods where the user was thinking while listening remained active.

Initial policy:

- Preserve normal short pauses.
- Shorten long thinking pauses to a few hundred milliseconds in derived provider audio.
- Treat pause boundaries as preferred batch boundaries.
- Flush remaining audio when the user stops, even if the batch is shorter than 10 seconds.

Exact pause thresholds are tunable implementation defaults, not product contracts. The important behavior is that short natural pauses remain, long thinking gaps are shortened in derived provider audio, and user stop always flushes remaining audio.

## Batch Duration Policy

Transcription providers may bill with a minimum duration per request. For Groq, the important planning assumption is a 10-second minimum billed length per audio request.

The planner should therefore:

- Prefer derived batches above 10 seconds.
- Target practical batches around 10-30 seconds when natural pauses allow it.
- Accept shorter final batches when the user stops.
- Allow longer batches when the user keeps speaking continuously.
- Avoid force-cutting continuous speech in the MVP.

Avoiding force-cuts is intentional. Splitting in the middle of a word or thought can produce worse behavior than sending a slightly longer transcription request.

## Provider Strategy

The initial provider candidates are OpenAI and Groq. Both should fit behind a small provider interface.

The provider abstraction should cover:

- Audio file or buffer input.
- Provider and model configuration.
- Raw transcript text.
- Optional response metadata.
- Actual and estimated billable audio duration.
- Failure details suitable for retry and debugging.

The rest of the product should depend on stored batches and transcripts, not on one provider's request format.

## Debug Audio Policy

Derived WAVs are useful while implementing and validating segmentation. They let developers listen to exactly what would be sent to a provider.

Final product behavior should be different:

- Do not store derived batch WAVs by default.
- Store enough mapping data to regenerate them from raw audio.
- Allow a debug action such as generating batch files on demand.
- Keep any debug path nullable in the database.

This avoids turning temporary implementation artifacts into permanent product data.

## Current Repo Integration Points

The main integration points are:

- `apps/desktop/src/main/dictation.ts`: current mock dictation controller and likely real orchestration entry point.
- `apps/desktop/src/main/state.ts`: in-memory app state store that currently exposes `idle`, `listening`, and `transcribing` phases.
- `apps/desktop/src/main/bootstrap.ts`: wires the dictation controller to permissions, windows, shortcuts, tray, state, and IPC.
- `packages/desktop-contracts/src/index.ts`: renderer-facing contracts for app state and IPC.
- `packages/desktop-ui`: presentation layer that consumes snapshots from the desktop API.

Audio capture, persistence, transcription queueing, and provider logic should stay in the main process. The renderer should receive state and history data through explicit contracts.

## Risks And Design Constraints

- Audio clipping at boundaries would damage trust quickly; pre-roll, post-roll, and conservative pause boundaries matter.
- Live mode can duplicate or skip audio if emitted source ranges are not tracked explicitly.
- Provider latency or failure can overlap with continued recording, so batch state and retry behavior must be visible.
- Native SQLite dependencies require Electron build and packaging validation.
- Retention cleanup must never delete an active session or files still referenced by persisted rows.
- The UI should not need to understand internal batch mechanics to show a coherent history.
