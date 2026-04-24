# Toph

Toph is a voice-to-text dictation app.

## Codebase map

- `apps/desktop`
  - Electron desktop app.
  - Owns the main process, IPC wiring, tray/windows, shortcuts, dictation state, and platform integration.

- `packages/desktop-ui`
  - React UI package for desktop surfaces.
  - Owns overlay/settings UI components, hooks, layouts, and styling.

- `packages/desktop-contracts`
  - Shared desktop types and constants.
  - Owns API contracts between Electron and UI code.

- `packages/shared`
  - Shared utilities intended to be reused across packages.

## Coding rules

- Before writing code, read:
  - `docs/engineering-guidance/README.md`
  - `docs/engineering-guidance/core-principles.md`
  - `docs/engineering-guidance/how-to-use.md`
  - Any relevant engineering guidance files for the change.
- Read relevant `package.json` files before changing code to understand scripts, dependencies, and package boundaries.
- Never run `pnpm run start`.
- After writing code, run from the repo root:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run build`
- As the last coding step, run the `engineering-guidance-reviewer` subagent.
