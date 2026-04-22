#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

MAIN_ENTRY="$ROOT_DIR/apps/desktop/out/main/index.js"
DESKTOP_ELECTRON_BIN="$ROOT_DIR/apps/desktop/node_modules/electron/dist/electron"
ROOT_ELECTRON_BIN="$ROOT_DIR/node_modules/electron/dist/electron"

if [ ! -f "$MAIN_ENTRY" ]; then
  printf '%s\n' "Toph desktop build is missing. Run 'pnpm build' first." >&2
  exit 1
fi

if [ -x "$DESKTOP_ELECTRON_BIN" ]; then
  ELECTRON_BIN="$DESKTOP_ELECTRON_BIN"
elif [ -x "$ROOT_ELECTRON_BIN" ]; then
  ELECTRON_BIN="$ROOT_ELECTRON_BIN"
else
  printf '%s\n' "Electron binary is missing. Run 'pnpm install' first." >&2
  exit 1
fi

export ELECTRON_DISABLE_SANDBOX=1

exec "$ELECTRON_BIN" --no-sandbox --disable-gpu "$MAIN_ENTRY" "$@"
