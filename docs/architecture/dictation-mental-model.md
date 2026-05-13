# Dictation Mental Model

## Purpose

This document defines the core concepts for Toph's dictation pipeline. Use this vocabulary consistently in code, docs, database tables, and developer discussions.

This is the canonical vocabulary document for the dictation pipeline. Other docs should link here rather than redefining these concepts in full.

## One Session Is One User Recording

A session is one user-visible recording interval:

```text
toggle on -> user speaks, pauses, thinks, speaks more -> toggle off
```

The user understands sessions, not internal batches. A session may contain many pauses and many transcription batches, but history and retention should be based on sessions.

The default retention policy should keep the last 10 sessions.

## Raw Audio Is The Source Of Truth

Each session has one raw WAV recording. The raw recording is preserved unchanged.

All other data derives from the raw audio:

- timeline regions,
- transcription batches,
- batch source ranges,
- derived batch WAVs,
- raw batch transcripts,
- final session outputs.

Silence shortening, batch generation, transcription, and polishing must not mutate the raw audio.

## Timeline Regions Describe The Raw Audio

Timeline regions are VAD results over the raw session audio.

Examples:

```text
region 1: speech  0ms-3200ms
region 2: silence 3200ms-7800ms
region 3: speech  7800ms-11600ms
region 4: silence 11600ms-12400ms
region 5: speech  12400ms-16000ms
```

Timeline regions answer:

- Where was the user speaking?
- Where was the user silent?
- Which silences were short natural pauses?
- Which silences were long thinking gaps?
- Can this session be reprocessed without running VAD again?

Timeline regions belong to the raw recording, not to a specific provider request.

## Batches Are Provider Requests

A batch is an internal transcription unit sent to a provider.

A batch is not the same as a user recording. A batch is also not necessarily a contiguous slice of raw audio. It can be assembled from several speech ranges and small preserved pause ranges.

Example:

```text
session abc
  batch 1: provider request for the first finalized derived clip
  batch 2: provider request for the next finalized derived clip
  batch 3: shorter final provider request flushed when the user stopped
```

The batch exists because provider work has its own lifecycle. Current batch statuses are:

- planned,
- transcribing,
- transcribed,
- failed.

Retry attempts are tracked on the batch; retry is not a separate batch status.

## Batch Source Ranges Are The Assembly Plan

Batch source ranges define exactly how a provider clip is built from raw audio.

For a long silence, the batch should not include the whole silent region. It should include only a small source slice from that silence, preserving a natural pause without paying for or transcribing a long thinking gap.

Example:

```text
raw audio:
0ms-3000ms      speech
3000ms-9000ms   long silence
9000ms-13000ms  speech

derived provider audio:
0ms-3000ms      source 0ms-3000ms
3000ms-3250ms   source 3000ms-3250ms
3250ms-7250ms   source 9000ms-13000ms
```

The raw silence was not mutated. The derived clip simply did not include most of it.

Batch source ranges make it possible to:

- regenerate or inspect derived audio,
- verify that no speech was clipped,
- map derived audio time back to raw audio time,
- re-run provider requests without re-planning the whole session.

## Transcripts Are Batch-Level Raw Provider Outputs

Raw transcription results belong to batches because actual transcription happens per batch.

The system should store each provider's raw text and useful metadata at the batch level. After the session ends and all batches are transcribed, the app can assemble the batch transcripts in sequence.

Raw batch transcripts should remain available even if a later polishing step creates cleaner final text.

## Session Outputs Are User-Level Text Results

A session output is the text result the user sees or pastes.

Current output kinds are:

- `raw_concat`: direct assembly of raw batch transcripts.
- `polished`: output from the polish engine after raw text has been assembled.

Output provenance matters. The app should know whether text came from raw concatenation or polishing, and which polish rule version produced a polished output.

## Live Mode Versus Offline Mode

Offline mode processes a complete raw recording. It can run VAD over the entire file, plan all batches, and generate derived batch audio after the session is already complete.

Live mode processes the same concepts incrementally while recording is active. It appends timeline regions, detects finalized boundaries, emits batches, and queues transcription while the user may still be speaking.

The concepts should stay the same in both modes:

```text
raw audio -> timeline regions -> batches -> batch source ranges -> transcripts -> session outputs
```

## Terminology To Prefer

- Use `session` for the user-visible recording from toggle-on to toggle-off.
- Use `batch` only for internal provider transcription units.
- Use `timeline region` for VAD speech/silence spans over raw audio.
- Use `batch source range` for the raw audio slices included in a provider clip.
- Use `polish` or `polishing` for the final LLM cleanup layer.

## Common Misunderstandings

Batches are not user-visible recordings. The user should see sessions and outputs, not internal provider request boundaries.

Silence shortening does not mutate raw audio. It only changes which source ranges are included in derived provider audio.

The system should not force-cut continuous speech. Prefer natural pause boundaries, even if a batch becomes longer than the target duration.

Raw audio remains the source of truth. Derived WAVs are generated from raw audio and batch source ranges; they should not be treated as the canonical recording.
