# Architecture, Modules, And Boundaries

## Purpose

Use this lens when the main question is whether a change improves or degrades the shape of the system.

This lens applies across backend, Electron, frontend, shared packages, and supporting library code.

## What This Lens Optimizes For

- evolvability
- boundary integrity
- local reasoning
- navigability
- change containment

## Responsibility Placement

Ask:

- Is this responsibility in the right module, package, or layer?
- Does this change move logic closer to its natural owner or further away?
- Is the abstraction based on a real capability boundary or just on file size?
- Are unrelated concerns being mixed because it was convenient for this change?

Look for designs where the same concept does not need to be explained, updated, or coordinated in too many places.

## Module Depth And Surface Area

Ask:

- Does this module hide meaningful complexity behind a small, understandable surface?
- Is the public surface smaller and clearer than the implementation behind it?
- Can a reader infer what the module owns, needs, returns, emits, affects, and does not own from its surface?
- Is this a deep module or a shallow wrapper?
- Would removing this abstraction make the code more honest?

Be suspicious of changes that add more files, more exports, or more helper layers without making the system easier to understand or change.

## Function Boundaries And Responsibility Shape

Ask:

- Does this function provide one coherent capability, even if it orchestrates several internal steps?
- Is this function boundary helping callers by hiding coordination, or forcing callers to stitch together too many small operations?
- Is the function broad internally but narrow and clear externally?
- Does the boundary reflect a meaningful unit of behavior rather than just splitting lines of code?

Do not equate good design with tiny functions. A function may legitimately update state, advance a workflow, call collaborators, and emit follow-up behavior if that forms one coherent capability.

## Naming Honesty

Ask:

- Does the name match the actual responsibility and side effects?
- Does the name sound narrower, safer, or more local than the real behavior?
- Would a new reader form the right expectations from the names alone?
- Are important state transitions or side effects hidden behind generic or vague names?

Names do not need to be perfect. They need to not mislead readers about what matters.

## Contracts And Public Surfaces

Ask:

- What contract is this code defining or changing?
- Is that contract explicit enough to reason about?
- Does the contract cover only types, or also semantics, ordering, ownership, and lifecycle expectations?
- Will this contract remain stable enough to evolve safely?
- Does the change widen the public surface more than necessary?

Treat contracts broadly. Types matter, but so do event meanings, runtime assumptions, and the semantics of exported behavior.

## Coupling, Coordination, And Change Amplification

Ask:

- Will future changes now require touching more places?
- Did this introduce a dependency that points in the wrong direction?
- Is one module now depending on details it should not need to know?
- Did this change make coordination across layers, packages, or runtime boundaries more expensive?

Prefer designs where a change stays local unless the concept itself is cross-cutting.

## Navigability And Change Flow

Ask:

- Can a new contributor or agent discover where this behavior lives?
- Can someone follow the main change flow without jumping across too many indirections?
- Are the important entry points and module boundaries discoverable from names and exports?
- Does this restructure make the codebase easier or harder to navigate?

Good structure helps readers answer where logic belongs before they have to inspect everything.

## Documentation And Intent

Ask:

- Is the reason for this abstraction or boundary obvious from the code?
- If not, is there enough supporting context in docs or module-level explanation?
- Would a future reader understand why this design exists and what tradeoff it is protecting?

Prefer short, durable explanations of intent over fragile code examples.

## Evidence That Is Especially Useful For This Lens

Useful evidence includes:

- smaller or clearer public surfaces
- reduced dependency reach
- reduced change amplification
- simpler ownership boundaries
- tests or reasoning that show contract stability
- docs that clarify non-obvious architectural intent

## Red Flags

Be suspicious when you see:

- extraction that mostly creates pass-through layers
- more modules but no clearer ownership
- generic utility layers absorbing domain behavior
- public surfaces growing faster than capability
- names that hide coordination or side effects
- abstractions that require readers to inspect internals just to understand the API
