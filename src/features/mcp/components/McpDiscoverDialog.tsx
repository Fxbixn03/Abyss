import type { McpServerEntry } from '@/shared/types/config'
import type { DiscoveryResult } from '@/shared/discovery/types'
import type { McpInstallSpec } from '@/shared/mcp/discovery'
import { installSpecToEntry } from '@/shared/mcp/discovery'
import { ipc } from '@/shared/ipc/ipc.client'
import { DiscoverDialog } from '@/shared/components/DiscoverDialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'

/**
 * MCP-server discovery: a thin wrapper around the generic {@link DiscoverDialog}
 * that renders MCP result cards and turns a chosen hit into a prefilled
 * {@link McpServerEntry} (passed to `onPick`, which opens the edit form).
 */
export function McpDiscoverDialog({
  open,
  onOpenChange,
  existingNames,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingNames: string[]
  onPick: (entry: McpServerEntry) => void
}) {
  return (
    <DiscoverDialog
      open={open}
      onOpenChange={onOpenChange}
      kind="mcp"
      title="Discover MCP servers"
      description="Search a registry and add a server with one click, then fill in any required paths or API keys."
      renderResult={(result) => (
        <McpResultCard
          result={result}
          onAdd={() => {
            onPick(
              installSpecToEntry(
                result.payload as McpInstallSpec,
                result.name,
                existingNames,
              ),
            )
            onOpenChange(false)
          }}
        />
      )}
    />
  )
}

function McpResultCard({
  result,
  onAdd,
}: {
  result: DiscoveryResult
  onAdd: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border p-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-code text-sm font-medium">
            {result.name}
          </span>
          {result.badges?.map((b, i) => (
            <Badge
              key={`${b.label}-${i}`}
              variant={b.variant === 'warning' ? 'warning' : 'muted'}
              className="shrink-0 font-code"
            >
              {b.label}
            </Badge>
          ))}
          {result.url && (
            <button
              type="button"
              title="Open repository"
              onClick={() => void ipc.openExternal(result.url!)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Icon name="external-link" className="size-3.5" />
            </button>
          )}
        </div>
        {result.description && (
          <p className="truncate text-xs text-muted-foreground">
            {result.description}
          </p>
        )}
      </div>
      <Button
        size="sm"
        onClick={onAdd}
        disabled={!result.installable}
        title={result.installable ? undefined : 'No installable package found'}
        className="shrink-0"
      >
        <Icon name="plus" />
        Add
      </Button>
    </div>
  )
}
