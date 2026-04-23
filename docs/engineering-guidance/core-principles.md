# Core Principles

## Purpose

These principles describe what good engineering looks like in this repo. They are not exhaustive. They exist to orient design and review toward the forms of decay that matter most here.

## What Engineering Work Should Optimize For

All engineering work should primarily protect these qualities:

- evolvability
- boundary integrity
- local reasoning
- behavioral safety
- verification quality
- navigability

## Principles

### Optimize For Future Change

Ask whether this decision will make the next change cheaper or more expensive. Good design reduces coordination cost, minimizes ripple effects, and keeps future refactors tractable.

### Preserve Boundaries

Most long-term architectural pain comes from eroded boundaries. Keep responsibilities, dependencies, and ownership clear across packages, modules, layers, and runtime boundaries.

### Prefer Deep Modules Over Shallow Fragmentation

Prefer modules that hide meaningful complexity behind small, legible surfaces. Do not reward decompositions that only create more files, wrappers, pass-through helpers, or coordination overhead.

Small units are not automatically better. Extraction is only an improvement when it improves isolation, clarity, replaceability, or change containment.

### Keep Surfaces Legible

A reader should be able to understand the purpose of a module or function largely from its public surface. Exports, function names, parameter shape, return shape, ownership boundaries, and key side effects should make the capability understandable without forcing a full internal read.

### Prefer Local Reasoning

Code is easier to evolve when a reader can understand one area without chasing unrelated layers, hidden dependencies, or indirect side effects. Prefer designs that reduce the amount of code and context someone must load to make a safe change.

### Make Contracts Explicit

Treat contracts broadly. Contracts include types, event semantics, IPC boundaries, state shape assumptions, public APIs, and lifecycle expectations. Make these contracts clear, stable, and easy to verify.

### Keep Behavior Honest And Visible

Hidden behavior is expensive behavior. Be suspicious when names sound narrower than the work they perform, when state transitions are hidden behind generic helpers, or when runtime effects and failures are difficult to infer from the call site or diagnose from the available signals.

### Concentrate Complexity Intentionally

Complexity cannot be eliminated, only moved. Prefer designs that keep tricky runtime, platform, orchestration, or state-machine complexity in a few intentional places instead of leaking it into ordinary code.

### Verification Should Match Risk

The right test and the right review depth depend on the kind of change. The goal is not maximum testing everywhere. The goal is enough evidence to trust the change, especially where contracts, boundaries, state flow, or runtime behavior are affected.

### Favor Navigability

The codebase should help a new contributor or agent find where logic belongs, how a feature flows, and which abstractions matter. Good engineering improves discovery and onboarding, not just correctness.

## Anti-Patterns These Principles Push Against

- shallow modularity that adds indirection without hiding complexity
- broad coupling that makes small changes expensive
- generic helper layers that hide important behavior
- names that underspecify responsibility or side effects
- runtime behavior that depends on non-obvious ordering or cleanup assumptions
- changes that are easy to merge but hard to verify or reason about later
