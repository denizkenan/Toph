/// <reference types="vite/client" />

import type { CaptureRendererApi, DesktopApi } from '@toph/desktop-contracts';

declare global {
  interface Window {
    toph: DesktopApi;
    tophCapture: CaptureRendererApi;
  }
}

export {};
