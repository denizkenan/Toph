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

- Always start by reading:
  - `docs/engineering-guidance/README.md`
  - `docs/engineering-guidance/core-principles.md`
  - `docs/engineering-guidance/how-to-use.md`
  - Additionally, make sure to read any relevant engineering guidance files before starting to code.
- Read relevant `package.json` files before changing code to understand scripts, dependencies, and package boundaries.
- Never run `pnpm run dev` or `pnpm run start`.
- After writing code, run from the repo root:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run build`
- Don't make git commits unless you have the user's explicit consent.
