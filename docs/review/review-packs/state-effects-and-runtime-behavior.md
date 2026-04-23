# State, Effects, And Runtime Behavior

## Purpose

Use this pack when the main question is whether the change makes runtime behavior safer, clearer, and easier to reason about.

This pack is broader than React. It covers state, effects, lifecycle, async behavior, event semantics, cross-runtime interaction, and resource usage. React guidance is included inline because it is a common source of risk in this repo.

## What This Pack Optimizes For

- behavioral safety
- local reasoning
- runtime predictability
- lifecycle safety
- performance and resource discipline
- diagnosability and runtime visibility
- verification quality

## State Ownership And Source Of Truth

Ask:

- Where does the source of truth live?
- Is state being stored because it is truly owned here, or only because it was convenient?
- Is the same fact now represented in multiple places?
- Are responsibilities for reading, mutating, and deriving state clearly separated?

Prefer designs where the owner of state is clear and duplication is minimized.

## Stored State Versus Derived State

Ask:

- Is this state necessary to store, or can it be derived from existing facts?
- Does this introduce synchronization work that would not exist if the value were derived?
- Will a future change need to keep multiple fields, stores, or effects in sync?
- Does the design make stale or contradictory state easier to create?

Be suspicious of state added only to make rendering or orchestration feel easier in the short term.

## Effects And Behavioral Honesty

Ask:

- Is this effect performing necessary synchronization, or compensating for unclear design?
- Are important transitions hidden behind generic update helpers or vague event handlers?
- Can a reader tell from the call site what side effects and follow-up behavior may occur?
- Are event semantics and ordering expectations explicit enough?

Effects are often necessary. The risk is not the existence of effects, but effects that hide behavior, duplicate derivation, or make state transitions hard to follow.

## Async Behavior, Ordering, And Staleness

Ask:

- What happens if async work finishes later than expected?
- Can requests, timers, subscriptions, or callbacks overlap in harmful ways?
- Is cancellation, replacement, debouncing, or last-write-wins behavior intentional?
- Are there stale closures, stale reads, or ordering assumptions that could break under timing changes?

Review async behavior as part of the design, not as an implementation detail.

## Failure Semantics And Degradation

Ask:

- What can fail here, and is that failure mode explicit enough for a reviewer to reason about?
- What happens immediately after failure?
- Is the failure surfaced, translated, swallowed, or silently ignored?
- Can partial failure leave stale, contradictory, or unsafe state behind?
- If the happy path fails, what degraded behavior should the user get?
- Does fallback preserve the important contract, or quietly change behavior in a confusing way?

Focus on making failure behavior understandable, bounded, and safe rather than enforcing generic error-handling patterns.

## Lifecycle And Cleanup

Ask:

- Who creates this resource and who cleans it up?
- What happens on unmount, window close, process exit, or teardown?
- Are listeners, subscriptions, timers, and long-lived resources always cleaned up?
- Does cleanup happen in the same conceptual place where ownership is established?

The more a change depends on lifecycle, the more review should focus on cleanup symmetry and ownership clarity.

## Diagnosability And Runtime Visibility

Ask:

- If this fails in production, what signal would a developer have?
- Can a reviewer infer the behavior from the code and the signals the system exposes?
- Are important runtime decisions, fallbacks, and failure paths visible enough to debug?
- Would support or debugging require guesswork, or is the behavior reconstructable after the fact?
- Is user-visible status enough here, or do developers also need stronger runtime breadcrumbs?

Make important behavior and failure paths inspectable enough for review and production debugging. This does not mean blanket logging.

## Runtime Boundaries And Event Semantics

Ask:

- Does this runtime boundary have an explicit contract?
- Are cross-process, cross-layer, or cross-module interactions easy to follow?
- Is behavior triggered from the side that naturally owns it, or through a surprising indirect path?
- Are event names and handler boundaries honest about what they cause?

Treat runtime boundaries as architectural boundaries. The fact that communication works does not mean the ownership model is clear.

## Trust Boundaries And Privilege Exposure

Ask:

- What trust boundary is being crossed here?
- Is the incoming data trusted, untrusted, or mixed?
- Is validation happening at the right boundary?
- Is this interface exposing more capability or privilege than necessary?
- Does this change widen the privileged surface across process, runtime, or system boundaries?
- Are values crossing IPC, process, or system boundaries safely enough for the level of trust involved?

Keep this lightweight. Catch widened privilege and unsafe boundary assumptions rather than running a full security audit on ordinary code.

## React Components, Custom Hooks, And Zustand

Ask:

- Is component state truly local, or should it live elsewhere?
- Does a custom hook hide meaningful behavior, or only relocate React noise?
- Are hooks exposing a clear capability surface?
- Are effects being used to synchronize values that could be derived during render or from existing state?
- Does the state shape in a Zustand store reflect coherent ownership?
- Are store actions modeling meaningful domain transitions, or just exposing ad hoc mutation?
- Are subscriptions or selectors scoped well enough to avoid unnecessary churn and hidden coupling?

Do not apply React folklore mechanically. Tie feedback to clarity, ownership, lifecycle safety, and runtime predictability.

## Performance And Resource Discipline

Ask:

- Is work happening in the right place and at the right frequency?
- Does this create unnecessary rerenders, repeated computation, or avoidable event churn?
- Are resources such as listeners, windows, timers, and external helpers used proportionally and cleaned up reliably?
- Is the design likely to stay efficient as behavior grows more complex?

Focus on structural performance problems rather than micro-optimizations.

## Evidence That Is Especially Useful For This Pack

Useful evidence includes:

- tests that exercise state transitions and cleanup behavior
- tests or reasoning that cover failure paths and degraded behavior
- reasoning that explains ownership and ordering guarantees
- manual verification for platform-sensitive or runtime-sensitive flows
- simpler control flow that removes synchronization burden
- explicit contracts for runtime events or IPC interactions
- signals that make important runtime decisions and failures diagnosable

## Red Flags

Be suspicious when you see:

- duplicated or contradictory state
- effects that mainly exist to keep state in sync with other state
- hidden side effects behind generic setters, patch helpers, or vague handlers
- async behavior that depends on timing but does not acknowledge ordering or cleanup
- silent failure or fallback behavior that is difficult to infer
- runtime behavior that cannot be reconstructed from code and available signals
- resources created in one place and implicitly cleaned up somewhere else
- widened privileged surfaces without clear boundary checks
- custom hooks or stores that expose many knobs without a clear ownership model
