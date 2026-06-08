import { collectionLabel } from '@/shared/agents/defs'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { NameDialog } from '@/shared/components/NameDialog'
import { UnsavedGuard } from '@/shared/components/UnsavedGuard'
import { DiffPreviewDialog } from '@/features/config/components/DiffPreviewDialog'
import { FileHistoryDialog } from '@/features/config/components/FileHistoryDialog'
import { NewItemDialog } from './NewItemDialog'
import { AgentDiscoverDialog } from './AgentDiscoverDialog'
import { buildTemplate } from '../lib/templates'
import type { CollectionController } from '../hooks/useCollectionManager'

/** Every modal behind the collection manager, driven by the controller's state. */
export function CollectionDialogs({ cm }: { cm: CollectionController }) {
  const { kind, labels, agentId, migrateKind, selectedItem } = cm

  return (
    <>
      <NewItemDialog
        open={cm.newOpen}
        onOpenChange={cm.setNewOpen}
        kind={kind}
        label={labels}
        existingIds={cm.items.map((i) => i.id)}
        onCreate={(values) => void cm.create(values.id, buildTemplate(kind, values))}
      />

      {kind === 'agents' && (
        <AgentDiscoverDialog
          open={cm.discoverOpen}
          onOpenChange={cm.setDiscoverOpen}
          onPick={(spec) => void cm.saveDiscovered(spec)}
        />
      )}

      <DiffPreviewDialog
        open={cm.diffOpen}
        onOpenChange={cm.setDiffOpen}
        filePath={cm.filePath}
        before={cm.original}
        after={cm.draft}
        saving={cm.saving}
        onConfirm={() => void cm.performSave()}
      />

      <ConfirmDialog
        open={cm.collision !== null}
        onOpenChange={(open) => {
          if (!open) cm.setCollision(null)
        }}
        title={`Skill "${cm.collision?.existingId}" already exists`}
        description={`Import this skill as a copy named "${cm.collision?.suggestedId}"?`}
        confirmLabel="Import copy"
        destructive={false}
        onConfirm={() => {
          const pending = cm.collision
          cm.setCollision(null)
          if (pending) void cm.runImport(pending.archivePath, 'suffix')
        }}
      />

      <ConfirmDialog
        open={cm.deleteOpen}
        onOpenChange={cm.setDeleteOpen}
        title={`Delete ${selectedItem?.name ?? 'item'}?`}
        description={
          kind === 'skills'
            ? 'This permanently removes the skill folder and its files.'
            : 'This permanently removes the file.'
        }
        confirmLabel="Delete"
        onConfirm={() => void cm.remove()}
      />

      <ConfirmDialog
        open={cm.migrateItem !== null}
        onOpenChange={(open) => {
          if (!open) cm.setMigrateItem(null)
        }}
        title={`Migrate "${cm.migrateItem?.name ?? 'item'}" to a ${
          migrateKind
            ? collectionLabel(agentId, migrateKind).singular.toLowerCase()
            : 'item'
        }?`}
        description={
          kind === 'skills'
            ? `This creates the command "${cm.migrateItem?.id}" from the skill's instructions and then deletes the skill folder. Files bundled with the skill are not carried over.`
            : `This creates the skill "${cm.migrateItem?.id}" from this command and then deletes the command file.`
        }
        confirmLabel="Migrate"
        onConfirm={() => {
          const pending = cm.migrateItem
          cm.setMigrateItem(null)
          if (pending) void cm.runMigrate(pending)
        }}
      />

      <NameDialog
        key={`rename-${cm.renameItem?.id ?? 'none'}`}
        open={cm.renameItem !== null}
        title={`Rename "${cm.renameItem?.name ?? ''}"`}
        initial={cm.renameItem?.id ?? ''}
        confirmLabel="Rename"
        placeholder="new-id"
        onOpenChange={(open) => {
          if (!open) cm.setRenameItem(null)
        }}
        onConfirm={(toId) => {
          const pending = cm.renameItem
          cm.setRenameItem(null)
          if (pending) void cm.runRename(pending, toId)
        }}
      />

      <NameDialog
        key={`dup-${cm.duplicateItem?.id ?? 'none'}`}
        open={cm.duplicateItem !== null}
        title={`Duplicate "${cm.duplicateItem?.name ?? ''}"`}
        initial={cm.duplicateItem ? `${cm.duplicateItem.id}-copy` : ''}
        confirmLabel="Duplicate"
        placeholder="new-id"
        onOpenChange={(open) => {
          if (!open) cm.setDuplicateItem(null)
        }}
        onConfirm={(newId) => {
          const pending = cm.duplicateItem
          cm.setDuplicateItem(null)
          if (pending) void cm.runDuplicate(pending, newId)
        }}
      />

      <ConfirmDialog
        open={cm.bulkDeleteOpen}
        onOpenChange={cm.setBulkDeleteOpen}
        title={`Delete ${cm.selected.size} ${labels.plural.toLowerCase()}?`}
        description="This permanently removes the selected items from disk."
        confirmLabel="Delete"
        onConfirm={() => void cm.doBulkDelete()}
      />

      {migrateKind && (
        <ConfirmDialog
          open={cm.bulkMigrateOpen}
          onOpenChange={cm.setBulkMigrateOpen}
          title={`Migrate ${cm.selected.size} to ${collectionLabel(agentId, migrateKind).plural}?`}
          description={`Each selected item is converted to a ${collectionLabel(
            agentId,
            migrateKind,
          ).singular.toLowerCase()} and removed from here. Name clashes are skipped.`}
          confirmLabel="Migrate"
          destructive={false}
          onConfirm={() => void cm.doBulkMigrate()}
        />
      )}

      <FileHistoryDialog
        open={cm.historyOpen}
        onOpenChange={cm.setHistoryOpen}
        filePath={cm.filePath}
        current={cm.original}
        onRestored={() => void cm.reloadFromDisk()}
      />

      <ConfirmDialog
        open={cm.pendingSelectId !== null}
        onOpenChange={(open) => {
          if (!open) cm.setPendingSelectId(null)
        }}
        title="Discard unsaved changes?"
        description={`You have unsaved edits on "${selectedItem?.name ?? 'this item'}". Opening another item will discard them.`}
        confirmLabel="Discard"
        onConfirm={() => {
          const next = cm.pendingSelectId
          cm.setPendingSelectId(null)
          if (next) cm.setSelectedId(next)
        }}
      />

      <UnsavedGuard dirty={cm.dirty} />
    </>
  )
}
