import { create } from 'zustand'
import type { AgentId, DetectedPath } from '@/shared/types/agent'
import { DEFAULT_APP_SETTINGS } from '@/shared/types/config'
import type { AppSettings } from '@/shared/types/config'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { useCustomAgentStore } from '@/features/agents/store/custom-agent.store'

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
    try {
      const [settings, detected] = await Promise.all([
        ipc.getSettings(),
        ipc.getDetectedPaths(),
      ])
      // Register the user's custom agents before the app gates open, so the
      // switcher/sidebar/themes pick them up on first paint.
      useCustomAgentStore.getState().hydrate(settings.customAgents ?? [])
      set({ settings, detected, loaded: true })
    } catch (err) {
      reportError(err, { title: "Couldn't load settings" })
    } finally {
      set({ loading: false })
    }
  },

  redetect: async (agentId) => {
    try {
      if (agentId) {
        const paths = await ipc.resolvePaths(agentId)
        set((s) => ({ detected: { ...s.detected, [agentId]: paths } }))
      } else {
        const detected = await ipc.getDetectedPaths()
        set({ detected })
      }
    } catch (err) {
      reportError(err, { title: "Couldn't detect agent paths" })
    }
  },

  setAgentPath: async (agentId, path) => {
    try {
      const settings = await ipc.setSettings({ agentPaths: { [agentId]: path } })
      set({ settings })
    } catch (err) {
      reportError(err, { title: "Couldn't update agent path" })
    }
  },

  updatePrefs: async (patch) => {
    try {
      const settings = await ipc.setSettings(patch)
      set({ settings })
    } catch (err) {
      reportError(err, { title: "Couldn't save preferences" })
    }
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
