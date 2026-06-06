import type { AgentAdapter, AgentId } from '@/shared/types/agent'
import { agentRegistry } from '../registry/agent.registry'
import { useAgentStore } from '../store/agent.store'
import { isAgentEnabled, useAgentEnabled } from '../store/agent-enabled.store'

/** Agents the user has enabled in Settings (the registry, filtered). */
export function useAllAgents(): AgentAdapter[] {
  const enabled = useAgentEnabled((s) => s.enabled)
  return agentRegistry.getAll().filter((a) => isAgentEnabled(enabled, a.id))
}

/** The currently active agent adapter (falls back to the first enabled one). */
export function useActiveAgent(): AgentAdapter {
  const id = useAgentStore((s) => s.activeAgentId)
  const agents = useAllAgents()
  return (
    agents.find((a) => a.id === id) ?? agents[0] ?? agentRegistry.getAll()[0]
  )
}

export function useActiveAgentId(): AgentId {
  return useActiveAgent().id
}
