import { create } from 'zustand'
import {
  EMPTY_PLUGINS_CONFIG,
  type PluginsConfig,
} from '@/shared/types/plugins'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'

interface PluginsState {
  config: PluginsConfig
  /** Last-saved config, for unsaved-edit detection. */
  saved: PluginsConfig
  loading: boolean
  saving: boolean
  load: (basePath: string) => Promise<void>
  update: (config: PluginsConfig) => void
  save: (basePath: string) => Promise<void>
}

export const usePluginsStore = create<PluginsState>()((set, get) => ({
  config: EMPTY_PLUGINS_CONFIG,
  saved: EMPTY_PLUGINS_CONFIG,
  loading: false,
  saving: false,

  load: async (basePath) => {
    set({ loading: true })
    try {
      const config = await ipc.getPlugins(basePath)
      set({ config, saved: config, loading: false })
    } catch (err) {
      set({ loading: false })
      reportError(err, { title: "Couldn't load plugins" })
    }
  },

  update: (config) => set({ config }),

  save: async (basePath) => {
    set({ saving: true })
    try {
      await ipc.setPlugins(basePath, get().config)
      set((s) => ({ saving: false, saved: s.config }))
    } catch (err) {
      set({ saving: false })
      reportError(err, { title: "Couldn't save plugins" })
    }
  },
}))
