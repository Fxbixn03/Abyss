import { cn } from '@/shared/lib/utils'
import { useActiveAgentId, useAllAgents } from '../hooks/useActiveAgent'
import { useAgentStore } from '../store/agent.store'
import { useAgentAvailability } from '../store/agent-availability.store'
import { AgentGlyph } from './AgentGlyph'

/**
 * Segmented control in the top bar. Selecting an agent makes it active, which
 * re-themes the entire shell instantly (see useThemeApplier).
 *
 * Agents whose CLI is not found on the machine are rendered with reduced
 * opacity so the user can see at a glance which agents are available.
 * Switching to an uninstalled agent is still permitted — the user may be
 * configuring it in advance.
 */
export function AgentSwitcher() {
  const agents = useAllAgents()
  const activeId = useActiveAgentId()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const availabilityStatus = useAgentAvailability((s) => s.status)

  return (
    <div
      data-tour="agent-switcher"
      className="no-drag flex items-center gap-1 rounded-lg border border-border bg-card/70 p-1"
    >
      {agents.map((agent) => {
        const active = agent.id === activeId
        const installed = availabilityStatus[agent.id]?.installed !== false
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => setActiveAgent(agent.id)}
            aria-pressed={active}
            title={
              installed
                ? undefined
                : `${agent.displayName} CLI not found — you can still configure it in advance`
            }
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              !installed && 'opacity-50',
            )}
          >
            <AgentGlyph agent={agent} className="size-4 rounded-[3px]" />
            <span>{agent.displayName}</span>
          </button>
        )
      })}
    </div>
  )
}
