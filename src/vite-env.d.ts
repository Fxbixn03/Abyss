/// <reference types="vite/client" />

import type { AbyssBridge } from '@/shared/types/ipc'

declare global {
  interface Window {
    /** Typed IPC bridge injected by the Electron preload script. */
    abyss: AbyssBridge
  }
}

export {}
