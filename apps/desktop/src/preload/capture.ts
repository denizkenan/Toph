import { contextBridge, ipcRenderer } from 'electron';

import type {
  CaptureChunkMessage,
  CaptureErrorMessage,
  CaptureLifecycleMessage,
  CaptureRendererApi,
  CaptureStartRequest,
} from '@toph/desktop-contracts';
import { DESKTOP_CAPTURE_IPC_CHANNELS } from '@toph/desktop-contracts';

const captureApi: CaptureRendererApi = {
  onStart(listener) {
    const subscription = (_event: Electron.IpcRendererEvent, request: CaptureStartRequest) => {
      listener(request);
    };

    ipcRenderer.on(DESKTOP_CAPTURE_IPC_CHANNELS.start, subscription);
    return () => {
      ipcRenderer.removeListener(DESKTOP_CAPTURE_IPC_CHANNELS.start, subscription);
    };
  },

  onStop(listener) {
    const subscription = () => {
      listener();
    };

    ipcRenderer.on(DESKTOP_CAPTURE_IPC_CHANNELS.stop, subscription);
    return () => {
      ipcRenderer.removeListener(DESKTOP_CAPTURE_IPC_CHANNELS.stop, subscription);
    };
  },

  sendStarted(message: CaptureLifecycleMessage) {
    ipcRenderer.send(DESKTOP_CAPTURE_IPC_CHANNELS.started, message);
  },

  sendStopped(message: CaptureLifecycleMessage) {
    ipcRenderer.send(DESKTOP_CAPTURE_IPC_CHANNELS.stopped, message);
  },

  sendChunk(message: CaptureChunkMessage) {
    ipcRenderer.send(DESKTOP_CAPTURE_IPC_CHANNELS.chunk, message);
  },

  sendError(message: CaptureErrorMessage) {
    ipcRenderer.send(DESKTOP_CAPTURE_IPC_CHANNELS.error, message);
  },
};

contextBridge.exposeInMainWorld('tophCapture', captureApi);
