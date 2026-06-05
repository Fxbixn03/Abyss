import { create } from 'zustand'
import type { AgentId, DetectedPath } from '@/shared/types/agent'
import { DEFAULT_APP_SETTINGS } from '@/shared/types/config'
import type { AppSettings } from '@/shared/types/config'
import { ipc } from '@/shared/ipc/ipc.client'

interface SettingsState {
  settings: AppSettings
  detected: Record<AgentId, DetectedPath[]>
  loaded: boolean
  loading: boolean

  load: () => Promise<void>
  redetect: (agentId?: AgentId) => Promise<void>
  setAgentPath: (agentId: AgentId, path: string) => Promise<void>
  updatePrefs: (patch: Partial<AppSettings>) => Promise<void>

  /** Effective base dir: explicit override -> existing detection -> first. */
  getBasePath: (agentId: AgentId) => string
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  detected: {},
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    const [settings, detected] = await Promise.all([
      ipc.getSettings(),
      ipc.getDetectedPaths(),
    ])
    set({ settings, detected, loaded: true, loading: false })
  },

  redetect: async (agentId) => {
    if (agentId) {
      const paths = await ipc.resolvePaths(agentId)
      set((s) => ({ detected: { ...s.detected, [agentId]: paths } }))
    } else {
      const detected = await ipc.getDetectedPaths()
      set({ detected })
    }
  },

  setAgentPath: async (agentId, path) => {
    const settings = await ipc.setSettings({ agentPaths: { [agentId]: path } })
    set({ settings })
  },

  updatePrefs: async (patch) => {
    const settings = await ipc.setSettings(patch)
    set({ settings })
  },

  getBasePath: (agentId) => {
    const { settings, detected } = get()
    const explicit = settings.agentPaths[agentId]
    if (explicit && explicit.trim() !== '') return explicit
    const candidates = detected[agentId] ?? []
    const existing = candidates.find((c) => c.exists)
    return existing?.path ?? candidates[0]?.path ?? ''
  },
}))
