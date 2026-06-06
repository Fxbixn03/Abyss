import { create } from 'zustand'
import type { AgentInstallStatus } from '@/shared/types/agent'
import { ipc } from '@/shared/ipc/ipc.client'
import { agentRegistry } from '../registry/agent.registry'

interface AgentAvailabilityState {
  /** Install status (CLI found + version) per agent id. */
  status: Record<string, AgentInstallStatus>
  loaded: boolean
  /** Re-check every registered agent's CLI install status. */
  refresh: () => Promise<void>
}

export const useAgentAvailability = create<AgentAvailabilityState>((set) => ({
  status: {},
  loaded: false,
  refresh: async () => {
    const ids = agentRegistry.getAll().map((a) => a.id)
    const entries = await Promise.all(
      ids.map(async (id) => [id, await ipc.agentInstallStatus(id)] as const),
    )
    set({ status: Object.fromEntries(entries), loaded: true })
  },
}))

/** Whether an agent's CLI was found on this machine. */
export function useAgentInstalled(agentId: string): boolean {
  return useAgentAvailability((s) => s.status[agentId]?.installed ?? false)
}
