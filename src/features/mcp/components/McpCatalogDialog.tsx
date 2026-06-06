import type { McpServerEntry } from '@/shared/types/config'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { MCP_CATALOG } from '@/shared/mcp/catalog'
import type { McpCatalogEntry } from '@/shared/mcp/catalog'
import { genId } from '@/shared/lib/id'

function toEntry(c: McpCatalogEntry, existingNames: string[]): McpServerEntry {
  let name = c.name
  let i = 1
  while (existingNames.includes(name)) name = `${c.name}-${++i}`
  return {
    id: genId(),
    name,
    type: 'stdio',
    command: c.command,
    args: c.args,
    url: '',
    env: Object.fromEntries((c.envKeys ?? []).map((k) => [k, ''])),
    enabled: true,
  }
}

export function McpCatalogDialog({
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>MCP server catalog</DialogTitle>
          <DialogDescription>
            Add a well-known server with one click, then fill in any required
            paths or API keys.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
          {MCP_CATALOG.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-md border border-border p-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-code text-sm font-medium">
                    {c.name}
                  </span>
                  {(c.envKeys ?? []).map((k) => (
                    <Badge key={k} variant="warning" className="font-code">
                      {k}
                    </Badge>
                  ))}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.description}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onPick(toEntry(c, existingNames))
                  onOpenChange(false)
                }}
              >
                <Icon name="plus" />
                Add
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
