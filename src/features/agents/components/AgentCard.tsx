import type { AgentAdapter } from '@/shared/types/agent'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'
import { useActiveAgentId } from '../hooks/useActiveAgent'
import { useAgentStore } from '../store/agent.store'
import {
  useAgentAvailability,
  useAgentInstalled,
} from '../store/agent-availability.store'
import { AgentAvatar } from './AgentAvatar'

export function AgentCard({ agent }: { agent: AgentAdapter }) {
  const activeId = useActiveAgentId()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const active = agent.id === activeId
  const installed = useAgentInstalled(agent.id)
  const availabilityLoaded = useAgentAvailability((s) => s.loaded)

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => setActiveAgent(agent.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setActiveAgent(agent.id)
      }}
      className={cn(
        'cursor-pointer p-4 transition-colors hover:border-primary/50',
        active && 'border-primary ring-1 ring-primary/40',
      )}
    >
      <div className="flex items-center gap-3">
        <AgentAvatar
          agent={agent}
          className="size-10"
          glyphToneClassName={
            active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{agent.displayName}</span>
            {installed ? (
              <Badge variant="success" className="font-code">
                active
              </Badge>
            ) : availabilityLoaded ? (
              <Badge variant="muted" className="font-code">
                not installed
              </Badge>
            ) : null}
          </div>
          <span className="font-code text-xs text-muted-foreground">
            {agent.name}
          </span>
        </div>
      </div>
    </Card>
  )
}
