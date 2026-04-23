# Default PR Review

## Purpose

This file defines the default review flow for this repo, usable by both humans and AI agents. The goal is to keep review frequent and practical while protecting long-term codebase health.

These review docs focus on engineering quality. They do not currently cover product, UX, or design review.

## Before You Start

Read `docs/review/core-review-principles.md` first unless you already know the repo's review values.

If the intended architecture or constraints are unclear, consult the relevant architecture docs before drawing conclusions.

## Review Input

Reviews may start from either:

- the PR diff or current git diff
- the conversation or work log that led to the code change

Use the available context to understand intent before drawing conclusions.

## Default Flow

1. Understand what changed and why.
2. Decide whether quick review or deep review is appropriate.
3. Read the relevant review pack or packs.
4. Identify the highest-value risks first.
5. Assign severity with a short explanation of why it matters in this repo.
6. Prefer a few strong findings over many generic comments.

## Which Review Pack To Read

### `review-packs/architecture-modules-and-boundaries.md` — when the main risk is system shape

Use this when the change raises questions like:

- Is responsibility in the right place?
- Is modularity real or just more files and wrappers?
- Are boundaries, contracts, exports, and dependencies getting healthier or leakier?
- Will future changes touch fewer places or more places?

### `review-packs/state-effects-and-runtime-behavior.md` — when the main risk is runtime behavior

Use this when the change raises questions like:

- Where does state live and who owns it?
- Are effects, subscriptions, async work, and cleanup easy to reason about?
- Are lifecycle transitions explicit enough?
- Are runtime boundaries, event semantics, or cross-process interactions safe?
- Will this create leaks, stale behavior, rerender churn, or ordering bugs?

If the main risk is unclear, skim both packs.

## Quick Review

Use quick review by default.

Ask:

- Is responsibility in the right place?
- Did coupling increase in a way that will make future changes harder?
- Are names, boundaries, and surfaces honest enough to understand the change quickly?
- Is state or runtime behavior still locally understandable?
- If this introduces a new package dependency, is it necessary and proportionate to its long-term maintenance, bundle, and security cost?
- Does the verification evidence match the risk of the change?
- Does anything important need deeper review?

Quick review catches drift, surfaces the main risks, and decides whether deeper analysis is needed.

## Deep Review

Use deep review when the change feels foundational, risky, or difficult to reverse.

Ask:

- What assumptions does this code make about boundaries, ordering, lifecycle, or environment?
- Which contracts changed, even if their TypeScript surface barely changed?
- What would become harder to change after this lands?
- What behavior is implicit rather than explicit?
- What failure, cleanup, or staleness cases could break this design?
- Is the chosen abstraction actually reducing coordination cost?

Deep review inspects consequences, not just syntax.

## Severity Model

### Blocker

The change is likely to damage evolvability, boundary integrity, behavioral safety, or verification quality. It should not merge as-is.

Examples:

- introduces an unsafe or unclear contract across a critical boundary
- hides behavior in a way likely to cause incorrectness
- creates a module shape that will cause lasting maintenance pain or change amplification
- depends on brittle ordering, cleanup, or environment assumptions

### Concern

A meaningful problem that may be acceptable if addressed or justified.

Examples:

- makes navigation or local reasoning noticeably worse
- increases coupling or spreads responsibility too widely
- has thin tests or evidence for the type of risk introduced
- names or boundaries are honest enough to pass but likely to confuse future readers

### Suggestion

An optional improvement that would strengthen the code without threatening correctness or architecture.

Examples:

- a clearer module surface or function name would improve navigability
- a small restructure would better align code with repo principles
- additional verification would improve confidence even if current evidence is probably sufficient

## What To Include In Review Feedback

Each finding should make clear:

- what the issue is
- why it matters
- which repo goal it threatens
- what evidence in the diff or change history supports the finding

Prefer explaining the direction of improvement over prescribing exact code unless the fix is obvious.

## Recommended Review Output

For AI reviewers, use this shape:

1. Findings first, ordered by severity.
2. For each finding, include severity, a short title, the reasoning, and concrete evidence.
3. If needed, include open questions or assumptions.
4. End with a short summary only after the findings.

If there are no findings, say so explicitly and mention any residual risk or verification gaps.

## Evidence Expectations

Evidence should match risk.

Ask whether the change provides enough confidence through some combination of:

- tests at the right level
- simpler design that reduces risk directly
- explicit reasoning in code or docs
- clear contracts and invariants
- manual verification for runtime or platform-sensitive behavior

Demand stronger evidence when boundaries, contracts, lifecycle behavior, or shared state become harder to reason about.

## Review Discipline

- Treat review pack questions as prompts, not a mechanical checklist.
- Do not manufacture findings just because a pack asks a question.
- Do not confuse familiarity with safety.
- Do not reward cleverness over clarity.
- Do not reward smaller units if they produce shallower modules.
- Do not over-apply framework folklore without tying it to actual repo risk.
- Do not flood the review with low-value comments.
- Tie feedback to repo goals, not generic best-practice language.
