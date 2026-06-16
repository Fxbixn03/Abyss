import { cn } from '@/shared/lib/utils'
import { Icon } from '@/shared/components/Icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { useActiveAgentId, useAllAgents } from '../hooks/useActiveAgent'
import { useAgentStore } from '../store/agent.store'
import { useAgentAvailability } from '../store/agent-availability.store'
import { AgentGlyph } from './AgentGlyph'

/**
 * Maximum number of agents to render inline as a segmented control.
 * Beyond this threshold the component collapses to an active-agent pill
 * + a dropdown that lists all agents, preventing the TopBar from overflowing.
 */
const MAX_INLINE = 4

/**
 * Segmented control in the top bar. Selecting an agent makes it active, which
 * re-themes the entire shell instantly (see useThemeApplier).
 *
 * Agents whose CLI is not found on the machine are rendered with reduced
 * opacity so the user can see at a glance which agents are available.
 * Switching to an uninstalled agent is still permitted — the user may be
 * configuring it in advance.
 *
 * When more than MAX_INLINE agents are enabled the control collapses to an
 * active-agent pill plus a Dropdown that lists all agents, preventing the
 * TopBar from overflowing horizontally.
 */
export function AgentSwitcher() {
  const agents = useAllAgents()
  const activeId = useActiveAgentId()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const availabilityStatus = useAgentAvailability((s) => s.status)

  const activeAgent = agents.find((a) => a.id === activeId) ?? agents[0]

  if (agents.length > MAX_INLINE) {
    return (
      <div
        role="toolbar"
        aria-label={`Agent switcher — ${activeAgent?.displayName ?? 'None'} is active`}
        data-tour="agent-switcher"
        className="no-drag flex items-center rounded-lg border border-border bg-card/70 p-1"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Active agent: ${activeAgent?.displayName ?? 'None'}. Click to switch agent.`}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                'bg-primary text-primary-foreground shadow-sm',
              )}
            >
              {activeAgent && (
                <AgentGlyph
                  agent={activeAgent}
                  className="size-4 rounded-[3px]"
                />
              )}
              <span>{activeAgent?.displayName ?? 'Select agent'}</span>
              <Icon name="chevron-down" className="size-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[10rem]">
            {agents.map((agent) => {
              const active = agent.id === activeId
              const installed =
                availabilityStatus[agent.id]?.installed !== false
              return (
                <DropdownMenuItem
                  key={agent.id}
                  onSelect={() => setActiveAgent(agent.id)}
                  title={
                    installed
                      ? undefined
                      : `${agent.displayName} CLI not found — you can still configure it in advance`
                  }
                  className={cn(
                    'flex items-center gap-2',
                    !installed && 'opacity-50',
                  )}
                >
                  <AgentGlyph agent={agent} className="size-4 rounded-[3px]" />
                  <span>{agent.displayName}</span>
                  {active && (
                    <Icon
                      name="check"
                      className="ml-auto size-3.5 text-primary"
                    />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div
      role="toolbar"
      aria-label={`Agent switcher — ${activeAgent?.displayName ?? 'None'} is active`}
      data-tour="agent-switcher"
      className="no-drag flex items-center gap-1 rounded-lg border border-border bg-card/70 p-1"
    >
      {agents.map((agent) => {
        const active = agent.id === activeId
        const installed = availabilityStatus[agent.id]?.installed !== false
        return (
          <Tooltip key={agent.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveAgent(agent.id)}
                aria-pressed={active}
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
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-medium">{agent.displayName}</p>
              {!installed && (
                <p className="text-xs text-muted-foreground">
                  CLI not installed — configuring in advance is still possible
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
