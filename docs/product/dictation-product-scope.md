# Dictation Product Scope

## Purpose

This document captures the product scope for Toph's real dictation functionality. It separates product decisions from the deeper architecture details in `docs/architecture/`.

## Product Goal

Toph should become a local desktop dictation app that can capture speech, transcribe it, optionally post-process it, and insert usable text into the user's active workflow.

The first product focus is developer-friendly dictation. The output should eventually handle spoken punctuation, file names, technical terms, identifiers, and instructions better than raw speech-to-text.

## MVP Behavior

The MVP should support:

- Toggle-on/toggle-off session recording.
- One user-visible session for each toggle-on to toggle-off interval.
- Persistence of the last 10 sessions.
- Raw audio stored unchanged for each retained session.
- Speech/silence analysis used to create internal transcription batches.
- Live batch creation while recording is active once boundaries are safe.
- Transcription of finalized batches while recording continues.
- Final batch flush when the user stops, even if the batch is shorter than the preferred duration.
- Post-processing only after the session is complete and all batch transcripts are available.

Paste behavior can remain secondary during early phases because the current app already proves clipboard and paste capability with mock transcription.

## User-Visible Concepts

The canonical technical vocabulary for sessions, batches, timeline regions, transcripts, and outputs lives in `docs/architecture/dictation-mental-model.md`.

Users should primarily understand:

- sessions,
- history,
- final text output,
- optionally raw versus post-processed output later.

A session is one complete recording interval. Users should not need to know how many provider batches were created under the hood.

## Internal Concepts Users Should Not Need To Know

These concepts are important internally but should not be prominent product concepts:

- timeline regions,
- transcription batches,
- batch source ranges,
- provider request count,
- derived debug WAVs.

The UI may expose some of this later for debugging, but normal usage should stay session-oriented.

## Provider Options

OpenAI and Groq are both valid initial transcription provider candidates.

The product should not be hardcoded around one provider. Provider selection can be a setting later, but the architecture should treat providers as replaceable from the beginning.

Provider-specific billing constraints can influence batching policy. For example, Groq has a 10-second minimum billed duration per audio request, so Toph should prefer batches above 10 seconds when the user keeps speaking.

## Future Product Options

Future product capabilities may include:

- generating debug batch files on demand,
- comparing raw and post-processed outputs,
- choosing provider and model settings,
- exposing cost and quality metadata,
- retrying failed batches,
- reprocessing old sessions,
- adding project glossary support,
- adding developer-specific post-processing modes.

These should not block the core MVP pipeline.
