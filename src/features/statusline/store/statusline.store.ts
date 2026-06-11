import { create } from 'zustand'
import {
  DEFAULT_STATUSLINE,
  type StatusLineConfig,
} from '@/shared/types/statusline'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'

interface StatusLineState {
  config: StatusLineConfig
  /** The last-saved config, so the page can flag unsaved edits. */
  saved: StatusLineConfig
  loading: boolean
  saving: boolean
  load: (basePath: string) => Promise<void>
  update: (patch: Partial<StatusLineConfig>) => void
  save: (basePath: string) => Promise<void>
  remove: (basePath: string) => Promise<void>
}

export const useStatusLineStore = create<StatusLineState>()((set, get) => ({
  config: { ...DEFAULT_STATUSLINE },
  saved: { ...DEFAULT_STATUSLINE },
  loading: false,
  saving: false,

  load: async (basePath) => {
    set({ loading: true })
    try {
      const config = await ipc.getStatusLine(basePath)
      set({ config, saved: config, loading: false })
    } catch (err) {
      set({ loading: false })
      reportError(err, { title: "Couldn't load the status line" })
    }
  },

  update: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

  save: async (basePath) => {
    set({ saving: true })
    try {
      await ipc.setStatusLine(basePath, get().config)
      const config: StatusLineConfig = {
        ...get().config,
        configured: true,
        managed: true,
        rawCommand: undefined,
      }
      set({ saving: false, config, saved: config })
    } catch (err) {
      set({ saving: false })
      reportError(err, { title: "Couldn't save the status line" })
    }
  },

  remove: async (basePath) => {
    set({ saving: true })
    try {
      await ipc.removeStatusLine(basePath)
      const config = { ...DEFAULT_STATUSLINE }
      set({ saving: false, config, saved: config })
    } catch (err) {
      set({ saving: false })
      reportError(err, { title: "Couldn't remove the status line" })
    }
  },
}))
