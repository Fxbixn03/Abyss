import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { ipc } from '@/shared/ipc/ipc.client'
import { MarkdownEditor } from '@/features/config/components/MarkdownEditor'
import type { CollectionController } from '../hooks/useCollectionManager'

/** Right pane: header (path + actions), external-change banner and the editor. */
export function CollectionEditor({ cm }: { cm: CollectionController }) {
  const { labels, icon, selectedItem, filePath, dirty, saving } = cm

  if (!selectedItem) {
    return (
      <EmptyState
        icon={icon}
        title={`No ${labels.singular.toLowerCase()} selected`}
        description={`Pick a ${labels.singular.toLowerCase()} to edit, or create a new one.`}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedItem.name}</span>
            {dirty && <Badge variant="default">unsaved</Badge>}
          </div>
          {filePath && (
            <button
              type="button"
              onClick={() => void ipc.revealPath(filePath)}
              className="flex max-w-full items-center gap-1 truncate font-code text-xs text-muted-foreground hover:text-foreground"
            >
              <Icon name="folder-open" className="size-3 shrink-0" />
              <span className="truncate">{filePath}</span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cm.setHistoryOpen(true)}
            disabled={!filePath}
          >
            <Icon name="history" />
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void ipc.revealPath(filePath)}
            disabled={!filePath}
          >
            <Icon name="folder-open" />
            Reveal
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cm.setDeleteOpen(true)}
          >
            <Icon name="trash" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cm.setDraft(cm.original)}
            disabled={!dirty || saving}
          >
            <Icon name="rotate-ccw" />
            Revert
          </Button>
          <Button size="sm" onClick={cm.requestSave} disabled={!dirty || saving}>
            <Icon name="save" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {cm.externalChanged && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="alert-triangle" className="size-4 shrink-0" />
            This file changed on disk.
          </span>
          <span className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void cm.reloadFromDisk()}
            >
              Reload
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cm.setExternalChanged(false)}
            >
              Keep editing
            </Button>
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <MarkdownEditor value={cm.draft} language="markdown" onChange={cm.setDraft} />
      </div>
    </div>
  )
}
