# Phase-Wise Implementation Plan

## Purpose

This document is the developer handoff plan for implementing real dictation in Toph. It breaks the work into testable phases so the recording, segmentation, live batching, transcription, assembly, and post-processing pipeline can be validated incrementally.

## Implementation Principles

- Build the smallest correct version of each phase.
- Keep every phase manually testable.
- Preserve raw audio unchanged.
- Use one session for one toggle-on to toggle-off recording.
- Keep internal batches hidden from the user-facing mental model.
- Preserve main-process ownership for recording, persistence, provider calls, and platform effects.
- Keep the renderer mostly state-driven.
- Introduce only the database schema needed for the current phase.
- Treat early local databases and migrations as disposable while the pipeline is still moving.
- Avoid broad test investment while the architecture is still moving.
- Add focused tests once planner and provider contracts stabilize.

## Phase 1: Persistence And Raw Session Recording

### Goals

Replace the mock-only dictation lifecycle with real session persistence and raw audio recording.

### Build Items

- Resolve local data storage from `TOPH_DATA_DIRECTORY` when set; otherwise use `$HOME/.toph`.
- During repository-local development, set `TOPH_DATA_DIRECTORY` to `<repo>/.toph` for easier debugging.
- Add SQLite persistence at `<dataDirectory>/data.db`.
- Add Drizzle schema and migrations.
- Validate `better-sqlite3` under the Electron build path before depending on it heavily.
- Create the `recording_sessions` table.
- Record one raw WAV file per toggle-on to toggle-off session.
- Store raw WAV files under `<dataDirectory>/recordings/<sessionId>/raw.wav`.
- Retain raw WAV files for the last 10 complete sessions.
- Keep pruned session rows in SQLite with `status = removed` so metadata remains inspectable.
- Do not prune active sessions.

### Phase 1 Sub-Phases

Phase 1 is intentionally split because persistence, native SQLite viability, and microphone capture carry different risks.

1. Add data directory resolution and validate SQLite/Drizzle bootstrapping.
2. Add the minimal persisted session lifecycle without transcription semantics.
3. Add a hidden Electron capture renderer that captures microphone PCM and streams chunks to the main process.
4. Write 16 kHz mono 16-bit PCM WAV files in the main process.
5. Integrate recording, session persistence, failure handling, and retention cleanup.
6. Update documentation with any implementation constraints discovered during the phase.

### Phase 1 Recorder Boundary

Use a separate hidden Electron capture renderer for microphone access. The capture renderer owns only browser microphone capture and chunk forwarding. The main process owns session lifecycle, database writes, raw WAV file writing, retention, and failure semantics.

Implement the recorder behind a pluggable main-process abstraction so Linux support or a future native/external recorder backend can be added without rewriting dictation orchestration. Phase 1 code should be written with macOS manual verification in mind, while keeping Linux implementation straightforward through the backend boundary.

### Phase 1 Renderer Contract

The UI may continue using the temporary `idle -> listening -> transcribing -> idle` shape, with a short failure state when recording fails. The database session statuses for Phase 1 should stay honest and minimal:

```text
recording -> recorded
recording -> failed
recorded/failed -> removed
```

Do not add future transcription, batch, or output tables until the phase that needs them.

### Expected State Transitions

Initial state transitions can remain simple:

```text
idle -> listening -> transcribing -> idle
```

This is the current renderer-facing contract. Phase 1 may keep those renderer labels temporarily while the persisted session lifecycle starts using real recording-oriented statuses.

As the implementation becomes real, the main process should expose more honest detail internally and eventually through contracts as needed:

```text
idle -> recording -> recorded -> segmenting -> transcribing -> completed
```

The UI does not need every database status immediately, but runtime behavior should not be hidden behind mock labels.

### Manual Verification

- Start dictation.
- Stop dictation.
- Confirm one session row exists in SQLite.
- Confirm one raw WAV exists for the session.
- Play the raw WAV and verify it matches the full toggle-on to toggle-off interval.
- Create more than 10 sessions and verify old complete session audio files are pruned safely while DB rows remain with `status = removed`.
- Force or simulate a recording failure and verify the overlay shows a temporary failed state.

### Done Criteria

Every dictation session produces one playable raw WAV and one persisted session row. The app retains raw WAV files for only the last 10 complete sessions by default, while older session metadata remains in SQLite as `removed`.

## Phase 2: Offline Segmentation And Batch Planning

### Goals

Given a completed raw WAV, detect speech/silence regions and create transcription batch plans without calling a transcription provider.

### Build Items

- Add VAD over a completed raw WAV.
- Store VAD output in `timeline_regions`.
- Build an offline batch planner.
- Store planned batches in `transcription_batches`.
- Store exact raw-to-derived mappings in `batch_source_ranges`.
- Add temporary or debug-only generation of derived batch WAVs for listening tests.

### Pause Policy

- Preserve normal short pauses.
- Shorten long thinking pauses to a few hundred milliseconds in derived audio.
- Prefer pause boundaries when finalizing batches.
- Prefer derived batch duration above 10 seconds.
- Flush the final batch even if it is shorter than 10 seconds.
- Do not force-cut continuous speech.

### Manual Verification

- Record a session with intentional long pauses.
- Run offline segmentation after recording completes.
- Inspect stored timeline regions.
- Generate debug batch WAVs.
- Listen to raw and derived audio.
- Verify long silence is shortened but speech is not clipped.

### Done Criteria

Given a completed raw recording, Toph can produce reusable timeline regions and sensible transcription batch plans with regenerable derived audio.

## Phase 3: Live Segmentation And Live Batch Planning

### Goals

Make the segmentation and batch planning logic work while recording is active.

### Build Items

- Run VAD incrementally while recording.
- Append live timeline regions as they become known.
- Track which source ranges have already been emitted into finalized batches.
- Finalize live batches only at safe pause boundaries or session stop.
- Generate temporary debug batch WAVs or debug logs as batches are created.
- Flush the final remaining batch when the user stops.

### Rules For Emitting A Live Batch

Emit a live batch when:

- a pause boundary is known,
- the derived duration is preferably above 10 seconds,
- the source ranges have not already been emitted,
- the boundary is safe enough to avoid clipping active speech.

A safe pause boundary means VAD has observed enough silence after speech to treat the previous speech region as complete. The exact threshold is tunable and should be validated by listening to generated debug clips.

If the user stops, flush remaining speech even when the final derived duration is under 10 seconds.

Do not force-cut active continuous speech in the MVP. If the user speaks continuously beyond the target duration, wait for a safe pause or session stop.

### Manual Verification

- Start recording.
- Speak, pause, speak again, and continue until more than 10 seconds of derived audio exists.
- Confirm a live batch is created before the session ends.
- Listen to the live-created debug WAV.
- Stop recording and confirm the remaining tail is flushed into a final batch.
- Verify live-created ranges do not duplicate or skip audio.

### Done Criteria

While recording is active, Toph can finalize batches using the same semantics as offline processing and can flush leftover audio on stop.

## Phase 4: Transcription Queue And Provider Integration

### Goals

Send finalized batches to a transcription provider while recording may still be active.

### Build Items

- Add a transcription provider interface.
- Add initial OpenAI and/or Groq implementation behind that interface.
- Add provider configuration in a minimal place.
- Queue finalized batches for transcription.
- Store provider results in `batch_transcripts`.
- Track batch status and errors.
- Preserve actual audio duration and estimated billable duration.
- Support retrying failed batches later.

### Behavior While Recording Continues

When a live batch is finalized, it should be queued immediately. Recording should continue while the provider request is in progress.

The session is not ready for final output until recording has stopped and all required batches are transcribed or failed in a visible way.

### Manual Verification

- Start a long dictation session.
- Confirm batch 1 is created and transcribed while recording continues.
- Stop recording.
- Confirm the final batch is queued and transcribed.
- Inspect `batch_transcripts` rows.
- Confirm failures are visible and do not corrupt session state.

### Done Criteria

Finalized batches can be transcribed during active recording, and raw transcript text is persisted per batch.

## Phase 5: Raw Transcript Assembly

### Goals

Create a session-level raw text output from ordered batch transcripts.

### Build Items

- Assemble batch transcripts by `transcription_batches.sequence`.
- Store the result in `session_outputs` with `kind = raw_concat`.
- Point the session at the selected final output.
- Show persisted output in history.
- Optionally paste the raw assembled transcript after session completion.

### Manual Verification

- Record a multi-batch session.
- Confirm all batch transcripts exist.
- Confirm one `raw_concat` session output is created.
- Restart the app and confirm the output remains available.
- If paste is enabled, confirm the final assembled text is pasted once after completion.

### Done Criteria

Toph can record, batch, transcribe, assemble, persist, and optionally paste one full raw session output.

## Phase 6: Post-Processing

### Goals

Run an LLM post-processing pass after recording is complete and all batch transcripts are available.

Post-processing should not run while recording is still active in the initial implementation. The app should wait until the full session has stopped and required batch transcripts are ready.

### Build Items

- Add a post-processing provider interface.
- Define a strict prompt and output shape for developer dictation.
- Feed ordered batch transcripts or the raw assembled transcript into post-processing.
- Store the result in `session_outputs` with `kind = llm_post_processed`.
- Preserve the raw `raw_concat` output.
- Add a setting or config path to enable or disable post-processing.
- Paste the post-processed output when enabled.

### Manual Verification

- Record a session with developer dictation content.
- Confirm raw batch transcripts remain available.
- Confirm `raw_concat` output remains available.
- Confirm `llm_post_processed` output is created separately.
- Confirm the final selected output is clear and persisted.

### Done Criteria

Post-processing creates a separate final output after session completion without destroying raw transcripts or raw assembled text.

## Phase 7: Cleanup And Hardening

### Goals

Remove temporary implementation behavior, validate packaging, and add tests around stable contracts.

### Build Items

- Gate or remove automatic debug WAV generation.
- Add an explicit debug action if derived batch files remain useful.
- Validate retention cleanup across database rows and files.
- Validate Electron build and packaging with SQLite dependencies.
- Add focused tests for stable planner behavior.
- Add focused tests for transcript assembly and provider boundary behavior.
- Improve settings/history UI only after the underlying lifecycle is stable.

### Manual Verification

- Confirm no unnecessary derived batch WAVs are retained by default.
- Confirm debug batch WAVs can be generated on demand if implemented.
- Confirm build/package path handles SQLite dependency.
- Confirm old sessions and files are pruned safely.

### Done Criteria

The real dictation pipeline is ready for daily dogfooding without temporary debug behavior leaking into normal product usage.

## Testing Strategy By Phase

Keep early tests light because the architecture will change.

Phase 1-3 should rely mainly on manual verification and a small number of pure-function tests if the planner has stable inputs and outputs.

Phase 4-6 should add focused tests around:

- batch planning invariants,
- no duplicate emitted source ranges,
- transcript assembly order,
- provider result persistence,
- post-processing output provenance.

Avoid broad UI and end-to-end test investment until the architecture stabilizes.

## Handoff Checklist

Before starting a phase, confirm:

- Which table changes are required?
- Which local files should be created?
- Which module owns the behavior?
- How will the phase be manually verified?
- Which temporary debug behavior is allowed?
- What must not become permanent product behavior?
- What state should the renderer see, if any?
- What failure state must be visible?

Before moving to the next phase, confirm:

- The phase's done criteria are met.
- Manual verification has been performed.
- Any temporary debug files or logs are understood.
- The next phase does not require rewriting the previous phase's core model.
