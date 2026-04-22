/// <reference types="vite/client" />

import type { DesktopApi } from '@toph/desktop-contracts'

declare global {
  interface Window {
    toph: DesktopApi
  }
}

export {}
