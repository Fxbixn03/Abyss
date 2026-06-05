import type { McpServerEntry } from '@/shared/types/config'
import { Switch } from '@/shared/components/ui/switch'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'

export interface McpServerListProps {
  servers: McpServerEntry[]
  onToggle: (id: string) => void
  onEdit: (server: McpServerEntry) => void
  onRemove: (id: string) => void
}

function summary(server: McpServerEntry): string {
  if (server.type === 'stdio') {
    return [server.command, ...(server.args ?? [])].filter(Boolean).join(' ')
  }
  return server.url ?? ''
}

export function McpServerList({
  servers,
  onToggle,
  onEdit,
  onRemove,
}: McpServerListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {servers.map((server) => (
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
      ))}
    </ul>
  )
}
