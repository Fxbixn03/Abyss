import type { AgentAdapter } from '@/shared/types/agent'
import { useAgentIcon } from '../hooks/useAgentIcon'
import { AgentIcon } from './AgentIcon'

/**
 * Resolves an agent's effective icon (override → default) and renders it.
 *
 * Use this in lists where the icon is rendered per agent — components are the
 * only place the `useAgentIcon` hook may be called, so mapping over agents needs
 * this boundary. For a single, already-resolved icon use {@link AgentIcon}.
 */
export function AgentGlyph({
  agent,
  className,
}: {
  agent: AgentAdapter
  className?: string
}) {
  const icon = useAgentIcon(agent)
  return <AgentIcon icon={icon} alt={agent.displayName} className={className} />
}
