# Reuse And Drift Prevention

## Purpose

Use this lens when a change introduces, extends, or modifies a pattern that may already exist elsewhere in the repo.

This lens is not only for UI code. It applies to components, modules, workflows, contracts, validation rules, lifecycle handling, persistence behavior, runtime state transitions, backend services, IPC boundaries, and supporting utilities.

The goal is proactive drift prevention: catching parallel implementations before they become independently evolving sources of behavioral, visual, UX, contract, or logic drift.

## What This Lens Optimizes For

- drift prevention
- future-change safety
- behavioral consistency
- visual and interaction consistency
- contract consistency
- reviewability
- local reasoning
- deep modules over shallow deduplication

## Lightweight Neighboring-Pattern Scan

Ask:

- Does this change introduce or materially modify a component, module, workflow, contract, validation rule, lifecycle pattern, or state transition?
- If so, is there nearby or related code that already solves a similar problem?
- Are there existing patterns in the same package, feature area, surface, boundary, or runtime layer that should be compared before approving this shape?
- Would a small scan of related files reveal an obvious shared abstraction or conflicting behavior?

Reviewers should do a lightweight neighboring-pattern scan when drift risk is plausible. This is not a full codebase audit. The goal is to catch obvious parallel implementations in relevant nearby code before they harden.

## Conceptual Duplication Versus Incidental Similarity

Ask:

- Are these implementations representing the same concept or just using similar syntax?
- Would future changes likely need to update both places for the same reason?
- Do they share the same user promise, state transition, validation rule, persistence semantics, lifecycle expectation, or runtime contract?
- Are the differences intentional domain differences, or incidental copy-paste variation?
- Would drift between these implementations cause confusing behavior, inconsistent UX, broken contracts, or maintenance risk?

Similarity alone is not the signal. Shared future-change pressure is the signal.

## Choosing The Reuse Boundary

Ask:

- Should reuse happen at the shell, layout, component, helper, contract, state-machine, service, validation, or module boundary?
- Is there a coherent capability that can hide meaningful complexity behind a smaller surface?
- Can the shared abstraction own the repeated decisions instead of forcing every caller to remember them?
- Would the caller-facing surface become clearer, narrower, or more honest?
- Would the abstraction prevent drift without making local reasoning worse?

Prefer the smallest shared boundary that owns the real repeated concept. Sometimes that is a shared shell. Sometimes it is an internal behavior module. Sometimes it is a shared contract or validation function. Sometimes reuse is the wrong move.

## Deep Reuse Versus Shallow DRY

Ask:

- Does this abstraction reduce future coordination cost, or only reduce line count?
- Does it hide meaningful repeated behavior, or just wrap markup/control flow that was easier inline?
- Are callers passing broad state objects, unrelated callbacks, flags, or mode strings to compensate for a weak abstraction?
- Would adding the next variant make the shared surface clearer or more awkward?
- Would removing the abstraction make the behavior more honest?

Good reuse prevents drift and improves the shape of the system. Bad reuse centralizes unrelated code, creates vague pass-through layers, and makes every caller harder to understand.

## Drift-Prone Areas

Pay particular attention to duplicated or parallel:

- user-facing flows, modal shells, settings sections, and interaction patterns
- state transitions, lifecycle handling, subscriptions, cleanup, and async sequencing
- validation, normalization, parsing, defaults, and persistence semantics
- IPC contracts, event semantics, provider/service boundaries, and error handling
- visual states such as loading, disabled, empty, busy, error, success, and destructive actions
- tests or fixtures that encode the same behavior in different shapes

These areas often work correctly at first and drift later as changes land unevenly.

## When Not To Reuse

Ask:

- Do these implementations have different ownership, lifecycle, domain semantics, or future direction?
- Would a shared abstraction couple areas that should be independently changeable?
- Is the repeated code small, stable, and unlikely to produce meaningful drift?
- Is the right abstraction boundary still unclear enough that extraction would be speculative?
- Would explicit duplication be easier to review and safer for now?

Duplication can be acceptable when it protects boundaries or local reasoning. If the team intentionally leaves duplication in place, the reason should be clear enough that future reviewers do not mistake it for accidental drift.

## Severity Calibration

Treat drift risk as a real engineering concern, not cosmetic cleanup.

### Blocker

Use Blocker when parallel implementations represent the same conceptual behavior, shape, contract, lifecycle, validation rule, or user-facing pattern; future drift is likely; and a shared deeper abstraction or shared contract is reasonably clear.

Examples:

- a third instance of the same workflow or shell is added without extraction or a clear reason not to reuse
- duplicated validation, persistence, IPC, lifecycle, or state-transition behavior can diverge and create inconsistent runtime behavior
- duplicated user-facing behavior can drift into inconsistent UX across surfaces that should feel or behave the same

### Concern

Use Concern when drift risk is real but the right shared boundary needs design judgment.

Examples:

- two implementations are converging on the same shape, but ownership or lifecycle differences still need weighing
- duplication is probably safe today but likely to become costly if the pattern expands
- a proposed abstraction prevents some drift but may weaken local reasoning or boundaries

### Nit

Use Nit when the reuse opportunity is marginal, low consequence, or speculative.

Examples:

- minor naming, visual, or helper duplication where drift risk is low
- extraction would be tidy but not meaningfully safer
- current duplication is easier to understand and unlikely to evolve independently

## Evidence That Is Especially Useful For This Lens

Useful evidence includes:

- a short comparison to nearby related patterns
- a shared abstraction that owns repeated behavior rather than just repeated syntax
- clearer contracts or common validation for duplicated semantics
- reduced visual, behavioral, lifecycle, or logic drift risk
- a concise reason for intentionally leaving duplication in place
- tests that exercise shared behavior once at the right boundary

## Red Flags

Be suspicious when you see:

- a second or third implementation of a similar workflow, shell, state transition, or contract
- repeated error, loading, empty, disabled, or destructive-action behavior implemented separately
- duplicated validation or normalization rules
- similar lifecycle or cleanup behavior copied across modules
- settings or product surfaces that look similar but use separate bespoke internals
- abstractions with broad props, flags, mode switches, or callback bags
- review comments that treat likely future drift as merely cosmetic
