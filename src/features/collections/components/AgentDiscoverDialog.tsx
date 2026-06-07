import type { DiscoveryResult } from '@/shared/discovery/types'
import type { DiscoveredAgentSpec } from '@/shared/agents/discovery'
import { ipc } from '@/shared/ipc/ipc.client'
import { DiscoverDialog } from '@/shared/components/DiscoverDialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'

/**
 * Agent discovery: a thin wrapper around the generic {@link DiscoverDialog} that
 * renders external-agent result cards. Picking one hands its spec to `onPick`,
 * which saves it as a local subagent.
 */
export function AgentDiscoverDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (spec: DiscoveredAgentSpec) => void
}) {
  return (
    <DiscoverDialog
      open={open}
      onOpenChange={onOpenChange}
      kind="agent"
      title="Discover AI agents"
      description="Search a registry and save an agent as a local subagent you can flesh out."
      renderResult={(result) => (
        <AgentResultCard
          result={result}
          onSave={() => {
            onPick(result.payload as DiscoveredAgentSpec)
            onOpenChange(false)
          }}
        />
      )}
    />
  )
}

function AgentResultCard({
  result,
  onSave,
}: {
  result: DiscoveryResult
  onSave: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border p-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{result.name}</span>
          {result.badges?.map((b, i) => (
            <Badge
              key={`${b.label}-${i}`}
              variant={b.variant === 'warning' ? 'warning' : 'muted'}
              className="shrink-0"
            >
              {b.label}
            </Badge>
          ))}
          {result.url && (
            <button
              type="button"
              title="Open website"
              onClick={() => void ipc.openExternal(result.url!)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Icon name="external-link" className="size-3.5" />
            </button>
          )}
        </div>
        {result.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {result.description}
          </p>
        )}
      </div>
      <Button size="sm" onClick={onSave} className="shrink-0">
        <Icon name="download" />
        Save
      </Button>
    </div>
  )
}
