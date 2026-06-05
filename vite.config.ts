import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// Single source of truth for path aliases, shared with the Electron sub-builds
// so `@/...` and `@core/...` resolve identically in renderer, main and preload.
const alias = {
  '@': path.resolve(__dirname, 'src'),
  '@core': path.resolve(__dirname, 'core'),
}

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    // Relative base so the packaged renderer loads assets over file://
    base: './',
    resolve: { alias },
    clearScreen: false,
    server: {
      port: 5123,
      strictPort: false,
    },
    plugins: [
      react(),
      tailwindcss(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            resolve: { alias },
            build: {
              outDir: 'dist-electron',
              minify: isBuild,
              sourcemap: !isBuild,
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
        preload: {
          input: 'electron/preload.ts',
          vite: {
            resolve: { alias },
            build: {
              outDir: 'dist-electron',
              minify: isBuild,
              sourcemap: !isBuild ? 'inline' : false,
              rollupOptions: {
                external: ['electron'],
                // Sandbox-safe preload must be CommonJS, emitted as preload.js
                output: {
                  format: 'cjs',
                  entryFileNames: 'preload.js',
                },
              },
            },
          },
        },
      }),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'chrome130',
    },
  }
})
