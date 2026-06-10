import { collectionLabel } from '@/shared/agents/defs'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  COLLECTION_SORTS,
  type CollectionController,
} from '../hooks/useCollectionManager'

/** Left rail: filter, bulk-selection bar and the selectable item list. */
export function CollectionList({ cm }: { cm: CollectionController }) {
  const { labels, icon, agentId, migrateKind, canMigrate } = cm

  return (
    <aside className="flex min-h-0 flex-col gap-2">
      {cm.items.length > 0 && (
        <div className="flex items-center gap-2">
          <Input
            value={cm.query}
            onChange={(e) => cm.setQuery(e.target.value)}
            placeholder={`Filter ${labels.plural.toLowerCase()}…`}
            className="flex-1"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" title="Sort">
                <Icon name="arrow-up-down" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {COLLECTION_SORTS.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => cm.setSortBy(s.id)}>
                  {cm.sortBy === s.id ? (
                    <Icon name="check" />
                  ) : (
                    <span className="size-4" />
                  )}
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {cm.selected.size > 0 && (
        <div className="flex items-center gap-1 rounded-md border border-primary/40 bg-accent px-2 py-1 text-xs">
          <span className="font-medium">{cm.selected.size} selected</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-destructive"
            onClick={() => cm.setBulkDeleteOpen(true)}
          >
            <Icon name="trash" />
            Delete
          </Button>
          {canMigrate && migrateKind && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6"
              onClick={() => cm.setBulkMigrateOpen(true)}
            >
              <Icon name="arrow-left-right" />
              Migrate
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6"
            onClick={cm.clearSelected}
          >
            Clear
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {!cm.loaded ? (
          <p className="px-1 text-sm text-muted-foreground">Loading…</p>
        ) : cm.items.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            No {labels.plural.toLowerCase()} yet.
          </p>
        ) : cm.filtered.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No matches.</p>
        ) : (
          cm.filtered.map((item) => {
            const active = item.id === cm.selectedId
            const checked = cm.selected.has(item.id)
            return (
              <div key={item.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => cm.toggleSelected(item.id)}
                  aria-label={`Select ${item.name}`}
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  {checked && <Icon name="check" className="size-3" />}
                </button>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={() => cm.requestSelect(item.id)}
                      className={cn(
                        'flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-primary/50 bg-accent'
                          : 'border-transparent hover:bg-accent/60',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon
                          name={icon}
                          className="size-4 text-muted-foreground"
                        />
                        <span className="truncate">{item.name}</span>
                        {item.model && (
                          <Badge variant="muted" className="ml-auto font-code">
                            {item.model}
                          </Badge>
                        )}
                        {item.argumentHint && (
                          <Badge
                            variant="muted"
                            className={cn(
                              'font-code text-[10px]',
                              !item.model && 'ml-auto',
                            )}
                          >
                            {item.argumentHint}
                          </Badge>
                        )}
                      </span>
                      {item.description && (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => cm.setRenameItem(item)}>
                      <Icon name="pencil" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => cm.setDuplicateItem(item)}>
                      <Icon name="copy" />
                      Duplicate
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void cm.runExport(item)}>
                      <Icon name="upload" />
                      Export
                    </ContextMenuItem>
                    {canMigrate && migrateKind && (
                      <ContextMenuItem onSelect={() => cm.setMigrateItem(item)}>
                        <Icon name="arrow-left-right" />
                        Migrate to{' '}
                        {collectionLabel(agentId, migrateKind).singular}
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem
                      onSelect={() => void ipc.revealPath(item.path)}
                    >
                      <Icon name="folder-open" />
                      Reveal in folder
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => {
                        cm.setSelectedId(item.id)
                        cm.setDeleteOpen(true)
                      }}
                    >
                      <Icon name="trash" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
