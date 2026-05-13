# Database Schema

## Purpose

This document describes the local SQLite data model for real dictation. The schema should make sessions, speech/silence analysis, provider batches, transcripts, and final outputs inspectable and reprocessable.

## Storage Location

Use `TOPH_DATA_DIRECTORY` when it is set. Otherwise, use `$HOME/.toph`. Repository-local development can set `TOPH_DATA_DIRECTORY` to `<repo>/.toph` so the database and recordings are easy to inspect. This default does not automatically migrate prior data from Electron's `userData` directory.

```text
<dataDirectory>/data.db
<dataDirectory>/recordings/<sessionId>/raw.wav
```

Optional debug files may be generated during implementation or on demand later. They should not be required durable product data.

## Technology Choice

Use SQLite for local persisted structured history.

Use Drizzle for typed schema and migrations. Drizzle should own the schema definition and migration history so database changes are explicit and reviewable.

Prefer `better-sqlite3` if Electron build and packaging validation works cleanly. `better-sqlite3` is the SQLite driver; the main risk is native module packaging with Electron. If packaging friction becomes unacceptable, revisit the SQLite driver before changing the higher-level persistence model.

## Retention Policy

Retain the last 10 complete sessions by default.

Retention should remove old raw audio files while keeping session rows for inspectability. Pruned rows should move to a status such as `removed` so the database records that the session existed but its local recording file is no longer retained. Retention must never prune an active recording session or files still referenced by retained `recorded` or `failed` rows.

Retention is based on user-visible sessions, not internal transcription batches.

For now, retention means deleting older session metadata and audio rather than keeping unlimited historical metadata.

## Tables Overview

The target schema includes these tables, but implementation should introduce only the tables needed by the current phase. Early databases and migrations are disposable while the dictation pipeline is still changing.

- `recording_sessions`
- `timeline_regions`
- `transcription_batches`
- `batch_source_ranges`
- `batch_transcripts`
- `session_outputs`
- `provider_usage_events`

## `recording_sessions`

One row represents one user-visible dictation session.

Columns:

- `id`
- `created_at`
- `started_at`
- `ended_at` nullable until recording stops
- `duration_ms` nullable until recording stops
- `raw_audio_path`
- `status`
- `final_output_id` nullable until a session output exists
- `error_message` nullable unless the session failed

Responsibility:

- Own the session lifecycle.
- Point to the raw audio file.
- Provide the main history list entry.
- Connect to timeline regions, batches, transcripts, and final outputs.

Suggested statuses:

- `recording`
- `recorded`
- `segmenting`
- `segmented`
- `transcribing`
- `transcribed`
- `post_processing`
- `completed`
- `failed`
- `removed`

`final_output_id` should point to the selected output for the session when one exists. A `removed` session row means retention cleanup removed the associated local audio file while preserving metadata for debugging/history.

## `timeline_regions`

Timeline regions store reusable VAD analysis over raw audio.

Columns:

- `id`
- `session_id`
- `sequence`
- `kind`
- `start_ms`
- `end_ms`
- `confidence`
- `created_live`

Responsibility:

- Describe speech and silence regions in the raw session audio.
- Avoid rerunning VAD when reprocessing a session.
- Support both offline and live batch planning.
- Provide debugging visibility into pause detection.

`kind` should initially be:

- `speech`
- `silence`

`created_live` records whether the region was created while recording was active. Offline reprocessing can create or replace regions later if needed.

`confidence` can be nullable if the selected VAD implementation does not produce a useful confidence value.

## `transcription_batches`

A transcription batch represents one provider transcription request.

Columns:

- `id`
- `session_id`
- `sequence`
- `status`
- `derived_duration_ms`
- `created_live`
- `debug_audio_path` nullable
- `created_at`
- `queued_at` nullable until queued
- `transcribed_at` nullable until transcribed
- `error_message` nullable unless the batch failed

Responsibility:

- Track one provider request lifecycle.
- Preserve batch ordering within a session.
- Provide a durable unit for retry, failure reporting, and transcript attachment.
- Record whether the batch was produced live or offline.

Do not make `source_start_ms` and `source_end_ms` required fields on this table. A batch may be made from multiple non-contiguous raw audio ranges, so those fields would be incomplete as the source of truth.

`debug_audio_path` should be nullable. Derived batch audio is not durable product data by default.

## `batch_source_ranges`

Batch source ranges define exactly how derived provider audio is assembled from raw audio.

Columns:

- `id`
- `batch_id`
- `timeline_region_id`
- `sequence`
- `source_start_ms`
- `source_end_ms`
- `derived_start_ms`
- `derived_end_ms`
- `reason`

Responsibility:

- Map raw audio slices to derived provider audio.
- Preserve enough information to regenerate debug WAVs on demand.
- Allow verification that speech was not clipped.
- Support derived-time to source-time debugging.

Suggested `reason` values:

- `speech`
- `pause_buffer`
- `normal_pause`

`timeline_region_id` can link back to the region that motivated the source range. It should be nullable if a range is created from a boundary buffer that does not map cleanly to one region.

`source_start_ms` and `source_end_ms` are timestamps in the raw session audio. `derived_start_ms` and `derived_end_ms` are timestamps in the derived provider clip created for that batch.

## `batch_transcripts`

Batch transcripts store raw provider output for one transcription batch.

Columns:

- `id`
- `batch_id`
- `provider`
- `model`
- `text`
- `created_at`

Responsibility:

- Store raw transcript text per provider request.
- Preserve provider and model provenance.
- Provide inputs for raw session transcript assembly and post-processing.

Provider request metadata, measured usage, billing mode, and estimated cost belong in `provider_usage_events`, linked by `related_entity_kind = batch_transcript` and `related_entity_id`.

## `session_outputs`

Session outputs store user-level final text results.

Columns:

- `id`
- `session_id`
- `kind`
- `text`
- `provider` nullable for outputs that are not created directly by one provider
- `model` nullable for outputs that are not created directly by one model
- `created_at`

Responsibility:

- Store final text that can be shown in history or pasted.
- Preserve how the output was created.
- Allow raw and post-processed outputs to coexist.

Suggested `kind` values:

- `raw_concat`
- `llm_post_processed`
- `manual_regenerated`

For `raw_concat`, `provider` and `model` may be null because the output is assembled from batch transcript rows. For `llm_post_processed`, `provider` and `model` should identify the post-processing model.

## `provider_usage_events`

Provider usage events store one immutable ledger row per provider call whose usage or estimated cost should be inspectable.

Columns:

- `id`
- `session_id`
- `operation_kind`
- `related_entity_kind`
- `related_entity_id`
- `provider`
- `model`
- `billing_mode`
- `audio_duration_ms` nullable for non-audio usage
- `billable_duration_ms` nullable when unknown or non-audio
- `input_tokens` nullable for audio-only usage
- `cached_input_tokens` nullable for audio-only usage
- `output_tokens` nullable for audio-only usage
- `estimated_cost_usd_micros`
- `cost_source`
- `pricing_catalog_provider_id` nullable
- `pricing_catalog_model_id` nullable
- `provider_request_id` nullable
- `provider_response_json` nullable
- `created_at`

Responsibility:

- Keep provider usage, billing classification, and pricing estimates in one queryable ledger.
- Preserve analytics inputs without spreading cost fields across domain tables.
- Let user-facing cost include only `billing_mode = metered` usage while retaining subscription usage for analytics.
- Link each usage row back to the transcript or output produced by the provider call.

`estimated_cost_usd_micros` is an estimated/catalog value, not necessarily user spend. Dashboard spend is derived from usage events by summing only metered billing mode rows.

## Why Both Timeline Regions And Batch Source Ranges Exist

Timeline regions describe the whole raw recording. They are the reusable speech/silence analysis.

Batch source ranges describe how one provider request's derived audio was assembled. They are the exact mapping for a batch.

Both are needed because they answer different questions:

- Timeline regions answer where speech and silence exist in the raw session.
- Batch source ranges answer what source audio was included in a specific provider request.

Together, they let the app avoid re-running VAD while still regenerating exact debug audio for a batch.

## Derived Batch Audio Policy

Derived batch WAVs should not be stored by default in the final product.

During implementation, generated batch WAVs are useful for listening tests. Later, a debug command or UI action can regenerate them on demand from:

- the raw session WAV,
- `transcription_batches`,
- `batch_source_ranges`.

The database should keep `debug_audio_path` nullable so debug behavior does not become required product behavior.

## Migration Notes

Initial migrations should keep the schema clear but not overfit future needs.

Prefer adding only indexes that match known access patterns, such as looking up sessions by creation time or child rows by `session_id` and `sequence`.

Avoid storing duplicate derived facts unless they remove meaningful runtime complexity. For example, batch source ranges should be the source of truth for source mapping instead of duplicating incomplete source boundaries on the batch row.

## Open Packaging Risk

`better-sqlite3` is a native dependency. It is widely used, but Electron packaging must be validated before treating it as risk-free.

This risk should be handled in the persistence phase before later phases depend heavily on the database layer.

During local development, rebuild native modules for Electron after install or Electron upgrades:

```text
pnpm --filter @toph/desktop rebuild:native
```
