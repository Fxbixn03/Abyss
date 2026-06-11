import { create } from 'zustand'
import { DEFAULT_SPINNER, type SpinnerConfig } from '@/shared/types/spinner'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'

interface SpinnerState {
  config: SpinnerConfig
  /** Last-saved config, so the page can flag unsaved edits. */
  saved: SpinnerConfig
  loading: boolean
  saving: boolean
  load: (basePath: string) => Promise<void>
  update: (patch: Partial<SpinnerConfig>) => void
  save: (basePath: string) => Promise<void>
}

export const useSpinnerStore = create<SpinnerState>()((set, get) => ({
  config: { ...DEFAULT_SPINNER },
  saved: { ...DEFAULT_SPINNER },
  loading: false,
  saving: false,

  load: async (basePath) => {
    set({ loading: true })
    try {
      const config = await ipc.getSpinner(basePath)
      set({ config, saved: config, loading: false })
    } catch (err) {
      set({ loading: false })
      reportError(err, { title: "Couldn't load spinner settings" })
    }
  },

  update: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

  save: async (basePath) => {
    set({ saving: true })
    try {
      await ipc.setSpinner(basePath, get().config)
      const config: SpinnerConfig = {
        ...get().config,
        verbsConfigured: get().config.verbs.some((v) => v.trim() !== ''),
        tipsConfigured: get().config.tips.some((t) => t.trim() !== ''),
      }
      set({ saving: false, config, saved: config })
    } catch (err) {
      set({ saving: false })
      reportError(err, { title: "Couldn't save spinner settings" })
    }
  },
}))
