# How To Use This Guidance

## Purpose

This file explains how to apply the engineering guidance in this repo while coding or reviewing.

## While Coding

Use the guidance to shape decisions before they harden into code.

Ask:

- Which principle or lens is most relevant to this change?
- Am I making future change cheaper or more expensive?
- Is this creating a deeper module or just more fragmentation?
- Is runtime behavior becoming clearer or more implicit?
- Will the evidence I leave behind be enough for someone else to trust this later?

## While Reviewing

Use the guidance to identify the highest-value risks in the change set.

Start by understanding:

- what changed
- why it changed
- which constraints or tradeoffs shaped it

Then use the relevant lens or lenses to judge the change against this repo's guidance rather than against generic best practices.

## Choosing A Lens

### Use `lenses/architecture-modules-and-boundaries.md` when the main risk is system shape

Use this when the change raises questions like:

- Is responsibility in the right place?
- Is modularity real or just more files and wrappers?
- Are boundaries, contracts, exports, and dependencies getting healthier or leakier?
- Will future changes touch fewer places or more places?

### Use `lenses/state-effects-and-runtime-behavior.md` when the main risk is runtime behavior

Use this when the change raises questions like:

- Where does state live and who owns it?
- Are effects, subscriptions, async work, and cleanup easy to reason about?
- Are lifecycle transitions explicit enough?
- Are runtime boundaries, failure handling, diagnosability, or cross-process interactions safe?
- Will this create leaks, stale behavior, rerender churn, or ordering bugs?

### Use `lenses/react-component-structure-and-reviewability.md` when the main risk is React UI structure

Use this when the change raises questions like:

- Is this React file still a reviewable unit?
- Should substantial subcomponents be split into colocated files?
- Is screen-specific or surface-specific UI easy to find together?
- Does the screen compose clear sections, or render everything inline?
- Are component props honest, narrow, and understandable?

If the main risk is unclear, skim the relevant lenses.

## Quick And Deep Use

### Quick

Use quick mode by default.

Ask:

- Is responsibility in the right place?
- Did coupling increase in a way that will make future changes harder?
- Are names, boundaries, and surfaces honest enough to understand the change quickly?
- Is state or runtime behavior still locally understandable?
- Are React component files still navigable and reviewable when the change touches UI code?
- If this introduces a new package dependency, is it necessary and proportionate to its long-term maintenance, bundle, and security cost?
- Does the verification evidence match the risk of the change?
- Does anything important need a deeper pass?

Quick mode catches drift, surfaces the main risks, and decides whether deeper analysis is needed.

### Deep

Use deep mode when the change feels foundational, risky, or difficult to reverse.

Ask:

- What assumptions does this code make about boundaries, ordering, lifecycle, or environment?
- Which contracts changed, even if their TypeScript surface barely changed?
- What would become harder to change after this lands?
- What behavior is implicit rather than explicit?
- What failure, cleanup, or staleness cases could break this design?
- Is the chosen abstraction actually reducing coordination cost?

Deep mode inspects consequences, not just syntax.

## Severity During Review

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
- adds avoidable dependency surface for limited benefit

### Suggestion

An optional improvement that would strengthen the code without threatening correctness or architecture.

Examples:

- a clearer module surface or function name would improve navigability
- a small restructure would better align code with repo principles
- additional verification would improve confidence even if current evidence is probably sufficient

## What Good Review Feedback Looks Like

Each finding should make clear:

- what the issue is
- why it matters
- which repo goal it threatens
- what evidence in the diff, code, or change history supports the finding

Prefer explaining the direction of improvement over prescribing exact code unless the fix is obvious.

For AI reviewers, a good default shape is:

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
- manual verification for runtime-sensitive or platform-sensitive behavior

Demand stronger evidence when boundaries, contracts, lifecycle behavior, or shared state become harder to reason about.

## Usage Discipline

- Treat guidance prompts as prompts, not a mechanical checklist.
- Do not manufacture findings just because a lens asks a question.
- Do not confuse familiarity with safety.
- Do not reward cleverness over clarity.
- Do not reward smaller units if they produce shallower modules.
- Do not over-apply framework folklore without tying it to actual repo risk.
- Do not flood reviews with low-value comments.
- Tie decisions and feedback back to repo goals rather than generic best-practice language.
