import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentId } from '@/shared/types/agent'
import { agentRegistry } from '../registry/agent.registry'

interface AgentState {
  activeAgentId: AgentId
  setActiveAgent: (id: AgentId) => void
}

const FALLBACK_AGENT_ID = agentRegistry.getAll()[0]?.id ?? 'claude'

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      activeAgentId: FALLBACK_AGENT_ID,
      setActiveAgent: (id) => {
        if (agentRegistry.has(id)) set({ activeAgentId: id })
      },
    }),
    {
      name: 'abyss-active-agent',
      // Heal stale persisted state if an agent was removed/renamed.
      onRehydrateStorage: () => (state) => {
        if (state && !agentRegistry.has(state.activeAgentId)) {
          state.activeAgentId = FALLBACK_AGENT_ID
        }
      },
    },
  ),
)
