import { create } from 'zustand'
import type { AgentId } from '@/shared/types/agent'
import type { ChatUsageStats } from '@/shared/types/chat'
import { ipc } from '@/shared/ipc/ipc.client'

/** Cached usage aggregate for one agent, plus its loading / error flags. */
export interface AgentUsageSlice {
  stats: ChatUsageStats | null
  loading: boolean
  error: boolean
}

interface UsageState {
  byAgent: Record<string, AgentUsageSlice>
  /** cwd (scope) the cache was built for; changing it drops cached results. */
  cwd: string | undefined
  /**
   * Fetch the usage aggregate for one agent. In-flight calls for the same agent
   * are de-duped; pass `force` to bypass that (e.g. a manual refresh). The core
   * side is mtime-cached, so a forced refetch never re-parses unchanged files.
   */
  load: (agentId: AgentId, cwd?: string, force?: boolean) => Promise<void>
  /** Fetch usage for several agents at once (cross-agent overview). */
  loadMany: (agentIds: AgentId[], cwd?: string, force?: boolean) => Promise<void>
}

export const useUsageStore = create<UsageState>()((set, get) => ({
  byAgent: {},
  cwd: undefined,

  load: async (agentId, cwd, force = false) => {
    // A scope change invalidates every cached agent slice.
    if (get().cwd !== cwd) set({ cwd, byAgent: {} })
    const existing = get().byAgent[agentId]
    if (!force && existing?.loading) return

    set((s) => ({
      byAgent: {
        ...s.byAgent,
        [agentId]: {
          stats: existing?.stats ?? null,
          loading: true,
          error: false,
        },
      },
    }))

    try {
      const stats = await ipc.chatUsageStats(agentId, cwd)
      if (get().cwd !== cwd) return
      set((s) => ({
        byAgent: {
          ...s.byAgent,
          [agentId]: { stats, loading: false, error: false },
        },
      }))
    } catch {
      if (get().cwd !== cwd) return
      set((s) => ({
        byAgent: {
          ...s.byAgent,
          [agentId]: {
            stats: s.byAgent[agentId]?.stats ?? null,
            loading: false,
            error: true,
          },
        },
      }))
    }
  },

  loadMany: async (agentIds, cwd, force = false) => {
    await Promise.all(agentIds.map((id) => get().load(id, cwd, force)))
  },
}))
