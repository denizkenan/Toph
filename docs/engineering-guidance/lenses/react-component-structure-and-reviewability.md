# React Component Structure And Reviewability

## Purpose

Use this lens when the main question is whether React UI code is organized into clear, navigable, reviewable component units.

This lens is primarily for `packages/desktop-ui`. It applies when a change affects component structure, screen organization, JSX-heavy files, component extraction, prop boundaries, or frontend diff reviewability.

## What This Lens Optimizes For

- reviewable React component files
- navigable UI structure
- clear screen and surface composition
- honest component contracts
- useful colocation
- avoiding giant JSX files
- avoiding shallow fragmentation

## Component Files As Reviewable Units

Ask:

- Can this file be reviewed as one understandable unit?
- Does this file have one primary component or one tightly related small unit?
- Are multiple substantial components competing for attention in the same file?
- Would splitting a component into its own colocated file make the diff easier to review?
- Does the file shape help a reader find the component they need without scrolling through unrelated JSX?

A React component file should generally be a reviewable unit: one meaningful component, or one tightly related small unit, with a clear responsibility and understandable prop surface.

This is not because small files are always better. React files are verbose because JSX, styling, handlers, props, and conditional rendering live close together. Large multi-component files make diffs harder to review and behavior harder to navigate.

## Colocate Screen And Surface UI

Ask:

- Is this component specific to one screen, surface, or feature?
- If so, is it colocated with the other components for that screen or surface?
- Is this component being promoted to a global shared area before it has a stable shared purpose?
- Can a reader find the screen's component pieces without searching across unrelated folders?

Prefer colocating screen-specific or surface-specific UI under `packages/desktop-ui/src/components/<screen-or-surface>/`.

Components do not need to be globally reusable to deserve their own file. A local component can be worth extracting when it improves navigation, diff review, or responsibility clarity.

The exact folder and file names may vary, but the default organizational move is to keep related screen or surface components together while avoiding one large file that owns every section, control, helper, and private component.

## Extract For Responsibility And Reviewability

Ask:

- Does this extraction isolate a meaningful UI section or interaction cluster?
- Does it give a noisy JSX region a useful name?
- Does it create a smaller and clearer review surface?
- Does it clarify the data and action boundary between parent and child?
- Would the original screen read more clearly as composition after this extraction?

Good extraction improves responsibility shape, reviewability, or change containment. It is not just line-count reduction.

Be suspicious of extraction that creates vague pass-through components, splits tiny markup that was easier inline, or forces readers to jump between files without gaining clarity.

## Screen Files Should Compose More Than They Render Everything

Ask:

- Can a reader see the major regions of the screen quickly?
- Does the screen file make top-level layout, data flow, and action wiring clear?
- Is the screen rendering every section, control, conditional branch, and interaction detail inline?
- Would named child components make the screen's structure easier to scan?

A screen or surface entry file can own high-level composition and wiring. It should make the page structure obvious.

When a screen file accumulates many sections, menus, controls, helpers, and local subcomponents, it becomes harder to review even if everything is technically local to that screen.

## Props And Component Contracts

Ask:

- Does the prop surface describe a coherent UI contract?
- Is the component receiving only the values and actions it needs?
- Are callbacks named around user or domain intent rather than implementation mechanics?
- Is parent state leaking too deeply into children?
- Would a reader understand what the component owns, displays, and can trigger from its props?

Extracted components should have honest, narrow prop surfaces. Do not split components in a way that requires passing broad state objects, unrelated callbacks, or implementation details through many layers.

## Hooks Should Encapsulate Behavior, Not Hide Clutter

Ask:

- Does this hook capture a coherent behavior, lifecycle, subscription, async workflow, or derived model?
- Is it hiding meaningful runtime behavior behind a clear capability surface?
- Or is it just a dumping ground for handlers removed from a large component file?
- Would the hook make the component easier to reason about without obscuring important effects?

Custom hooks are useful when they clarify ownership and behavior. They are not a substitute for good component boundaries.

Use `state-effects-and-runtime-behavior.md` when the hook introduces meaningful state, async, lifecycle, or subscription risk.

## Evidence That Is Especially Useful For This Lens

Useful evidence includes:

- smaller component diffs with clear file ownership
- screen files that read as composition rather than large JSX blobs
- colocated screen or surface components that are easy to find together
- prop surfaces that make component responsibilities obvious
- extracted components that can be reviewed independently
- removed private subcomponent clusters from large screen files

## Red Flags

Be suspicious when you see:

- a screen file containing many substantial private components
- a single diff touching unrelated UI sections because they live in one file
- reviewers needing to scroll through hundreds of lines of JSX to understand a small behavior change
- extracted components with vague names or pass-through props
- components receiving broad state objects when they only need a few values
- local UI buried in one giant file or prematurely promoted as globally reusable
- custom hooks used as junk drawers for miscellaneous handlers
