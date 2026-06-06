import type { McpServerEntry } from '@/shared/types/config'
import { Switch } from '@/shared/components/ui/switch'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import type { McpHealthState } from '../store/mcp.store'

export interface McpServerListProps {
  servers: McpServerEntry[]
  health: Record<string, McpHealthState>
  onToggle: (id: string) => void
  onEdit: (server: McpServerEntry) => void
  onRemove: (id: string) => void
  onTest: (server: McpServerEntry) => void
}

function summary(server: McpServerEntry): string {
  if (server.type === 'stdio') {
    return [server.command, ...(server.args ?? [])].filter(Boolean).join(' ')
  }
  return server.url ?? ''
}

function HealthBadge({ state }: { state: McpHealthState }) {
  if ('loading' in state) {
    return (
      <Badge variant="muted">
        <Icon name="loader" className="size-3 animate-spin" />
        checking…
      </Badge>
    )
  }
  if (state.ok) {
    const title =
      state.tools.length > 0 ? `${state.tools.length} tools` : 'reachable'
    return (
      <Badge variant="success" title={title}>
        <Icon name="circle-check" />
        online
        {state.tools.length > 0 ? ` · ${state.tools.length}` : ''}
      </Badge>
    )
  }
  return (
    <Badge variant="danger" title={state.error}>
      <Icon name="circle-alert" />
      offline
    </Badge>
  )
}

export function McpServerList({
  servers,
  health,
  onToggle,
  onEdit,
  onRemove,
  onTest,
}: McpServerListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {servers.map((server) => {
        const state = health[server.id]
        return (
          <li
            key={server.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <Switch
              checked={server.enabled}
              onCheckedChange={() => onToggle(server.id)}
              aria-label={`Toggle ${server.name}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{server.name}</span>
                <Badge variant="muted" className="font-code">
                  {server.type}
                </Badge>
                {state && <HealthBadge state={state} />}
              </div>
              <p
                data-selectable
                className="truncate font-code text-xs text-muted-foreground"
                title={summary(server)}
              >
                {summary(server) || '—'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTest(server)}
              disabled={Boolean(state && 'loading' in state)}
            >
              <Icon name="plug" />
              Test
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(server)}
              aria-label={`Edit ${server.name}`}
            >
              <Icon name="pencil" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemove(server.id)}
              aria-label={`Remove ${server.name}`}
            >
              <Icon name="trash" />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
