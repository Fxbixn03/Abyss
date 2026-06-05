import type { AgentAdapter } from '@/shared/types/agent'
import { useAgentIconStore } from '../store/agent-icon.store'

/**
 * The effective icon string for an agent: the user's override if set, otherwise
 * the agent's built-in default (`agent.icon`).
 */
export function useAgentIcon(agent: AgentAdapter): string {
  return useAgentIconStore((s) => s.icons[agent.id] ?? agent.icon)
}
