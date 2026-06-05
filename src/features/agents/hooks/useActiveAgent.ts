import type { AgentAdapter, AgentId } from '@/shared/types/agent'
import { agentRegistry } from '../registry/agent.registry'
import { useAgentStore } from '../store/agent.store'

/** The currently active agent adapter (with a safe fallback). */
export function useActiveAgent(): AgentAdapter {
  const id = useAgentStore((s) => s.activeAgentId)
  return agentRegistry.has(id) ? agentRegistry.get(id) : agentRegistry.getAll()[0]
}

export function useActiveAgentId(): AgentId {
  return useActiveAgent().id
}

export function useAllAgents(): AgentAdapter[] {
  return agentRegistry.getAll()
}
