import type { AgentAdapter } from '@/shared/types/agent'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { cn } from '@/shared/lib/utils'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useActiveAgentId } from '../hooks/useActiveAgent'
import { useAgentStore } from '../store/agent.store'
import { useAgentAvailability } from '../store/agent-availability.store'
import { AgentAvatar } from './AgentAvatar'

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function AgentCard({
  agent,
  lastUsedAt,
}: {
  agent: AgentAdapter
  /** Most-recent session timestamp from the usage aggregate, when known. */
  lastUsedAt?: string
}) {
  const activeId = useActiveAgentId()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const active = agent.id === activeId
  const availability = useAgentAvailability((s) => s.status[agent.id])
  const availabilityLoaded = useAgentAvailability((s) => s.loaded)
  const installed = availability?.installed ?? false
  const version = availability?.version
  const cliPath = availability?.path
  const configBase = useConfigBase(agent.id)
  const hasConfigPath = Boolean(configBase)
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
          <div className="flex items-center gap-1.5">
            <span className="font-code text-xs text-muted-foreground">
              {agent.name}
            </span>
            {installed && version && (
              <span
                className="truncate font-code text-xs text-muted-foreground/80"
                title={cliPath ? `Installed at ${cliPath}` : undefined}
              >
                · {version}
              </span>
            )}
          </div>
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

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span
          className="flex items-center gap-1"
          title={hasConfigPath ? configBase : 'No config path set'}
        >
          <Icon
            name={hasConfigPath ? 'folder-open' : 'folder'}
            className="size-3.5 shrink-0"
          />
          <span className="truncate">
            {hasConfigPath ? 'config set' : 'no config path'}
          </span>
        </span>
        {lastUsedAt && (
          <span className="flex items-center gap-1">
            <Icon name="clock" className="size-3.5 shrink-0" />
            used {relativeTime(lastUsedAt)}
          </span>
        )}
      </div>
    </Card>
  )
}
