# Engineering Guidance

## Purpose

This directory contains the engineering guidance for this repo. These docs are meant to sharpen judgment while coding and reviewing, not replace it.

The guidance is question-driven, non-prescriptive, and intentionally opinionated toward keeping the codebase maintainable, modular, navigable, and easy to evolve.

These docs focus on engineering quality. They do not currently cover product, UX, or design review.

## Start Here

Read these docs in this order unless you already know the repo's guidance well:

1. `docs/engineering-guidance/core-principles.md`
2. `docs/engineering-guidance/how-to-use.md`
3. One or more docs in `docs/engineering-guidance/lenses/`, depending on the change or decision at hand

If the intended architecture, constraints, or tradeoffs are unclear, consult the relevant architecture docs before drawing conclusions.

## What This Guidance Optimizes For

Across coding and review, this repo's engineering guidance primarily protects:

- evolvability
- boundary integrity
- local reasoning
- behavioral safety
- verification quality
- navigability

## Guidance Map

### `core-principles.md`

The durable engineering principles that define what good looks like in this repo.

### `how-to-use.md`

How to apply this guidance while coding or reviewing, including quick vs deep usage, severity, evidence expectations, and feedback shape.

### `lenses/architecture-modules-and-boundaries.md`

Use this lens when the main question is whether the shape of the system is getting healthier or worse.

### `lenses/state-effects-and-runtime-behavior.md`

Use this lens when the main question is whether runtime behavior is safe, understandable, diagnosable, and easy to evolve.

### `lenses/react-component-structure-and-reviewability.md`

Use this lens when the main question is whether React UI code is organized into clear, navigable, reviewable component units.

## How To Think About These Docs

- Treat the guidance as prompts, not a mechanical checklist.
- Prefer a few high-value insights over broad generic critique.
- Use one lens when the main risk is clear; use multiple lenses when the change cuts across concerns.
- Let repo guidance drive your judgment rather than generic framework folklore.
