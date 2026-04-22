import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(rootDir, 'src/renderer/src'),
        '@shared': resolve(rootDir, 'src/shared'),
      },
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
})
