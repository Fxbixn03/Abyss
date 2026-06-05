import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentId } from '@/shared/types/agent'

/**
 * Per-agent icon overrides. A pure UI preference (like the per-agent theme map),
 * so it lives in the renderer with `persist` rather than on disk — the CLI and
 * config files have no use for it.
 *
 * Absence of an entry means "use the agent's built-in default" (`agent.icon`).
 */
interface AgentIconState {
  /** agentId -> chosen icon string (see agent-icons.ts for the format). */
  icons: Record<AgentId, string>
  setIcon: (agentId: AgentId, icon: string) => void
  resetIcon: (agentId: AgentId) => void
}

export const useAgentIconStore = create<AgentIconState>()(
  persist(
    (set) => ({
      icons: {},
      setIcon: (agentId, icon) =>
        set((s) => ({ icons: { ...s.icons, [agentId]: icon } })),
      resetIcon: (agentId) =>
        set((s) => {
          if (!(agentId in s.icons)) return s
          const icons = { ...s.icons }
          delete icons[agentId]
          return { icons }
        }),
    }),
    { name: 'abyss-agent-icons' },
  ),
)
