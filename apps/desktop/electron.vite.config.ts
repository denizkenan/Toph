import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const rootDir = dirname(fileURLToPath(import.meta.url));
const workspaceAliases = {
  '@renderer': resolve(rootDir, 'src/renderer/src'),
  '@toph/desktop-contracts': resolve(rootDir, '../../packages/desktop-contracts/src/index.ts'),
  '@toph/desktop-ui': resolve(rootDir, '../../packages/desktop-ui/src/index.ts'),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: workspaceAliases,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: workspaceAliases,
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: workspaceAliases,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(rootDir, 'src/renderer/index.html'),
          overlay: resolve(rootDir, 'src/renderer/overlay.html'),
        },
      },
    },
  },
});
