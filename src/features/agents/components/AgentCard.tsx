import type { AgentAdapter } from '@/shared/types/agent'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
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
  const docsUrl = agent.docsUrl

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

        {docsUrl && (
          <button
            type="button"
            aria-label={`Open ${agent.displayName} documentation`}
            title="Official documentation"
            onClick={(e) => {
              e.stopPropagation()
              void ipc.openExternal(docsUrl)
            }}
            className="ml-auto flex shrink-0 items-center gap-1.5 self-start rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Icon name="book-open" className="size-3.5" />
            <span className="hidden lg:inline">Docs</span>
            <Icon name="external-link" className="size-3" />
          </button>
        )}
      </div>
    </Card>
  )
}
