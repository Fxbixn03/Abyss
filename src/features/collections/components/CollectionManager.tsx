import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  CollectionItem,
  CollectionKind,
  SkillCollisionMode,
} from '@/shared/types/collections'
import { COLLECTION_LABELS } from '@/shared/types/collections'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import { Icon } from '@/shared/components/Icon'
import { NameDialog } from '@/shared/components/NameDialog'
import { useFileWatch } from '@/shared/hooks/useFileWatch'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useCollectionSelection } from '../store/collectionSelection.store'
import { MarkdownEditor } from '@/features/config/components/MarkdownEditor'
import { DiffPreviewDialog } from '@/features/config/components/DiffPreviewDialog'
import { FileHistoryDialog } from '@/features/config/components/FileHistoryDialog'
import { UnsavedGuard } from '@/shared/components/UnsavedGuard'
import { NewItemDialog } from './NewItemDialog'
import { buildTemplate } from '../lib/templates'

export interface CollectionManagerProps {
  kind: CollectionKind
  icon: string
}

export function CollectionManager({ kind, icon }: CollectionManagerProps) {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const confirmDiff = useSettingsStore((s) => s.settings.confirmDiffBeforeSave)
  const labels = COLLECTION_LABELS[kind]
  const supported = agent.capabilities[kind]

  // Skills and commands are both markdown files, so one can be converted into
  // the other. `null` for agents (no equivalent), which disables migration.
  const migrateKind: CollectionKind | null =
    kind === 'skills' ? 'commands' : kind === 'commands' ? 'skills' : null
  const canMigrate = migrateKind !== null && agent.capabilities[migrateKind]

  const [items, setItems] = useState<CollectionItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Item the user clicked while the open one has unsaved edits, pending confirm.
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null)

  const [original, setOriginal] = useState('')
  const [draft, setDraft] = useState('')
  const [filePath, setFilePath] = useState('')
  const [saving, setSaving] = useState(false)

  const [diffOpen, setDiffOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Item targeted by the right-click "Migrate" action, awaiting confirmation.
  const [migrateItem, setMigrateItem] = useState<CollectionItem | null>(null)
  const [renameItem, setRenameItem] = useState<CollectionItem | null>(null)
  const [duplicateItem, setDuplicateItem] = useState<CollectionItem | null>(
    null,
  )
  const [query, setQuery] = useState('')
  const [externalChanged, setExternalChanged] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkMigrateOpen, setBulkMigrateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Skill import (from a downloaded `.skill` archive).
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [collision, setCollision] = useState<{
    archivePath: string
    existingId: string
    suggestedId: string
  } | null>(null)

  const dirty = draft !== original

  // Switching items discards the open draft, so confirm first when it's dirty.
  const requestSelect = (id: string) => {
    if (id === selectedId) return
    if (dirty) setPendingSelectId(id)
    else setSelectedId(id)
  }

  // Used by the event handlers (create/save/delete) to reload the list.
  const refresh = useCallback(async () => {
    if (!supported || !basePath) return
    const list = await ipc.listCollection(basePath, kind)
    setItems(list)
    setLoaded(true)
  }, [supported, basePath, kind])

  // Initial / dependency-driven load. Inlined (setState inside the promise
  // callback) so it doesn't trip react-hooks set-state-in-effect.
  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.listCollection(basePath, kind).then((list) => {
      if (!active) return
      setItems(list)
      setLoaded(true)
      // A command-palette "go to item" pending for this kind (cross-page).
      const pendingId = useCollectionSelection.getState().consume(kind)
      if (pendingId && list.some((i) => i.id === pendingId)) {
        setSelectedId(pendingId)
      }
    })
    return () => {
      active = false
    }
  }, [supported, basePath, kind])

  // React to palette selections while already on this page (same-page).
  useEffect(
    () =>
      useCollectionSelection.subscribe((state) => {
        if (state.pending && state.pending.kind === kind) {
          setSelectedId(state.pending.id)
          useCollectionSelection.getState().consume(kind)
        }
      }),
    [kind],
  )

  useEffect(() => {
    if (!selectedId || !basePath) return
    let active = true
    void ipc.readCollectionItem(basePath, kind, selectedId).then((r) => {
      if (!active) return
      setOriginal(r.content)
      setDraft(r.content)
      setFilePath(r.path)
    })
    return () => {
      active = false
    }
  }, [selectedId, basePath, kind])

  const performSave = useCallback(async () => {
    if (!basePath || !selectedId) return
    setSaving(true)
    await ipc.writeCollectionItem(basePath, kind, selectedId, draft)
    setOriginal(draft)
    setSaving(false)
    setDiffOpen(false)
    void refresh()
  }, [basePath, kind, selectedId, draft, refresh])

  const requestSave = useCallback(() => {
    if (!dirty) return
    if (confirmDiff) setDiffOpen(true)
    else void performSave()
  }, [dirty, confirmDiff, performSave])

  // Detect external edits to the open item and offer a reload.
  const onExternal = useCallback(async () => {
    if (!basePath || !selectedId) return
    const r = await ipc.readCollectionItem(basePath, kind, selectedId)
    if (r.content !== original) setExternalChanged(true)
  }, [basePath, kind, selectedId, original])
  useFileWatch(filePath, onExternal)

  const reloadFromDisk = async () => {
    if (!basePath || !selectedId) return
    const r = await ipc.readCollectionItem(basePath, kind, selectedId)
    setOriginal(r.content)
    setDraft(r.content)
    setExternalChanged(false)
  }

  // Cmd/Ctrl+S saves the open item, matching the instructions editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        requestSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestSave])

  const create = async (id: string, content: string) => {
    if (!basePath) return
    await ipc.writeCollectionItem(basePath, kind, id, content)
    await refresh()
    setSelectedId(id)
  }

  const remove = async () => {
    if (!basePath || !selectedId) return
    await ipc.deleteCollectionItem(basePath, kind, selectedId)
    setDeleteOpen(false)
    setSelectedId(null)
    setOriginal('')
    setDraft('')
    setFilePath('')
    void refresh()
  }

  const runRename = async (item: CollectionItem, toId: string) => {
    if (!basePath) return
    setNotice(null)
    try {
      const r = await ipc.renameCollectionItem(basePath, kind, item.id, toId)
      await refresh()
      if (selectedId === item.id) setSelectedId(r.id)
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to rename.',
      })
    }
  }

  const runDuplicate = async (item: CollectionItem, newId: string) => {
    if (!basePath) return
    setNotice(null)
    try {
      const r = await ipc.duplicateCollectionItem(
        basePath,
        kind,
        item.id,
        newId,
      )
      await refresh()
      setSelectedId(r.id)
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to duplicate.',
      })
    }
  }

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const clearSelected = () => setSelected(new Set())

  const doBulkDelete = async () => {
    if (!basePath) return
    const ids = [...selected]
    setBulkDeleteOpen(false)
    for (const id of ids) await ipc.deleteCollectionItem(basePath, kind, id)
    if (selectedId && ids.includes(selectedId)) {
      setSelectedId(null)
      setOriginal('')
      setDraft('')
      setFilePath('')
    }
    clearSelected()
    void refresh()
  }

  const doBulkMigrate = async () => {
    if (!basePath || !migrateKind) return
    const ids = [...selected]
    setBulkMigrateOpen(false)
    setNotice(null)
    let moved = 0
    for (const id of ids) {
      try {
        await ipc.migrateCollectionItem(basePath, kind, migrateKind, id)
        moved += 1
      } catch {
        // skip items that can't migrate (e.g. name clash)
      }
    }
    if (selectedId && ids.includes(selectedId)) setSelectedId(null)
    clearSelected()
    setNotice({
      type: 'success',
      message: `Migrated ${moved} of ${ids.length} to ${COLLECTION_LABELS[migrateKind].plural}.`,
    })
    void refresh()
  }

  const runExport = async (item: CollectionItem) => {
    if (!basePath) return
    setNotice(null)
    try {
      const { path } = await ipc.exportCollectionItem(basePath, kind, item.id)
      if (path) {
        setNotice({ type: 'success', message: `Exported to ${path}` })
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to export.',
      })
    }
  }

  // Convert a skill into a command (or vice versa): the markdown moves to the
  // sibling collection under the same id, then the source is deleted.
  const runMigrate = async (item: CollectionItem) => {
    if (!basePath || !migrateKind) return
    setNotice(null)
    try {
      await ipc.migrateCollectionItem(basePath, kind, migrateKind, item.id)
      if (selectedId === item.id) {
        setSelectedId(null)
        setOriginal('')
        setDraft('')
        setFilePath('')
      }
      setNotice({
        type: 'success',
        message: `Migrated "${item.name}" to a ${COLLECTION_LABELS[
          migrateKind
        ].singular.toLowerCase()} — find it on the ${
          COLLECTION_LABELS[migrateKind].plural
        } page.`,
      })
      await refresh()
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to migrate item.',
      })
    }
  }

  // Read a downloaded `.skill` archive and unpack it into this agent's skills.
  // A name clash returns 'collision' first so we can confirm importing a copy.
  const runImport = async (
    archivePath: string,
    onCollision: SkillCollisionMode,
  ) => {
    if (!basePath) return
    setImporting(true)
    try {
      const result = await ipc.importSkill(basePath, archivePath, onCollision)
      if (result.status === 'collision') {
        setCollision({
          archivePath,
          existingId: result.existingId,
          suggestedId: result.suggestedId,
        })
      } else {
        setNotice({
          type: 'success',
          message: `Imported skill "${result.name}".`,
        })
        await refresh()
        setSelectedId(result.id)
      }
    } catch (err) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to import skill.',
      })
    } finally {
      setImporting(false)
    }
  }

  const startImport = async () => {
    setNotice(null)
    const { path } = await ipc.pickFile({
      title: 'Import Skill',
      filters: [
        { name: 'Claude Skill', extensions: ['skill', 'zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (path) await runImport(path, 'fail')
  }

  if (!supported) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={labels.plural} icon={icon} />
        <EmptyState
          icon={icon}
          title={`${agent.displayName} has no ${labels.plural.toLowerCase()}`}
          description={`Switch to an agent that supports ${labels.plural.toLowerCase()}.`}
        />
      </div>
    )
  }

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title={labels.plural} icon={icon} />
        <EmptyState
          icon="folder"
          title="No config location set"
          description={`Set a config directory in Settings to manage ${labels.plural.toLowerCase()}.`}
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              Open Settings
            </Button>
          }
        />
      </div>
    )
  }

  const selectedItem = items.find((i) => i.id === selectedId) ?? null

  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q),
      )
    : items

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={labels.plural}
        description={`${labels.plural} for ${agent.displayName}`}
        icon={icon}
        actions={
          <div className="flex items-center gap-2">
            {kind === 'skills' && (
              <Button
                variant="outline"
                onClick={() => void startImport()}
                disabled={importing}
              >
                <Icon name="download" />
                {importing ? 'Importing…' : 'Import'}
              </Button>
            )}
            <Button onClick={() => setNewOpen(true)}>
              <Icon name="file-plus" />
              New {labels.singular}
            </Button>
          </div>
        }
      />

      {notice && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm',
            notice.type === 'success'
              ? 'border-primary/40 bg-accent text-foreground'
              : 'border-destructive/40 bg-destructive/10 text-destructive',
          )}
        >
          <span className="flex items-center gap-2">
            <Icon
              name={notice.type === 'success' ? 'circle-check' : 'circle-alert'}
              className="size-4 shrink-0"
            />
            <span>{notice.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-4">
        <aside className="flex min-h-0 flex-col gap-2">
          {items.length > 0 && (
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${labels.plural.toLowerCase()}…`}
            />
          )}
          {selected.size > 0 && (
            <div className="flex items-center gap-1 rounded-md border border-primary/40 bg-accent px-2 py-1 text-xs">
              <span className="font-medium">{selected.size} selected</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Icon name="trash" />
                Delete
              </Button>
              {canMigrate && migrateKind && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6"
                  onClick={() => setBulkMigrateOpen(true)}
                >
                  <Icon name="arrow-left-right" />
                  Migrate
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6"
                onClick={clearSelected}
              >
                Clear
              </Button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {!loaded ? (
              <p className="px-1 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">
                No {labels.plural.toLowerCase()} yet.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((item) => {
                const active = item.id === selectedId
                const checked = selected.has(item.id)
                return (
                  <div key={item.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleSelected(item.id)}
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
                          onClick={() => requestSelect(item.id)}
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
                              <Badge
                                variant="muted"
                                className="ml-auto font-code"
                              >
                                {item.model}
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
                        <ContextMenuItem onSelect={() => setRenameItem(item)}>
                          <Icon name="pencil" />
                          Rename
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => setDuplicateItem(item)}
                        >
                          <Icon name="copy" />
                          Duplicate
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => void runExport(item)}>
                          <Icon name="upload" />
                          Export
                        </ContextMenuItem>
                        {canMigrate && migrateKind && (
                          <ContextMenuItem
                            onSelect={() => setMigrateItem(item)}
                          >
                            <Icon name="arrow-left-right" />
                            Migrate to {COLLECTION_LABELS[migrateKind].singular}
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
                            setSelectedId(item.id)
                            setDeleteOpen(true)
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

        <section className="min-h-0 rounded-lg border border-border bg-card/40 p-4">
          {!selectedItem ? (
            <EmptyState
              icon={icon}
              title={`No ${labels.singular.toLowerCase()} selected`}
              description={`Pick a ${labels.singular.toLowerCase()} to edit, or create a new one.`}
            />
          ) : (
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
                    onClick={() => setHistoryOpen(true)}
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
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Icon name="trash" />
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft(original)}
                    disabled={!dirty || saving}
                  >
                    <Icon name="rotate-ccw" />
                    Revert
                  </Button>
                  <Button
                    size="sm"
                    onClick={requestSave}
                    disabled={!dirty || saving}
                  >
                    <Icon name="save" />
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>

              {externalChanged && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Icon name="alert-triangle" className="size-4 shrink-0" />
                    This file changed on disk.
                  </span>
                  <span className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void reloadFromDisk()}
                    >
                      Reload
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExternalChanged(false)}
                    >
                      Keep editing
                    </Button>
                  </span>
                </div>
              )}

              <div className="min-h-0 flex-1">
                <MarkdownEditor
                  value={draft}
                  language="markdown"
                  onChange={setDraft}
                />
              </div>
            </div>
          )}
        </section>
      </div>

      <NewItemDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        kind={kind}
        existingIds={items.map((i) => i.id)}
        onCreate={(values) =>
          void create(values.id, buildTemplate(kind, values))
        }
      />

      <DiffPreviewDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        filePath={filePath}
        before={original}
        after={draft}
        saving={saving}
        onConfirm={() => void performSave()}
      />

      <ConfirmDialog
        open={collision !== null}
        onOpenChange={(open) => {
          if (!open) setCollision(null)
        }}
        title={`Skill "${collision?.existingId}" already exists`}
        description={`Import this skill as a copy named "${collision?.suggestedId}"?`}
        confirmLabel="Import copy"
        destructive={false}
        onConfirm={() => {
          const pending = collision
          setCollision(null)
          if (pending) void runImport(pending.archivePath, 'suffix')
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selectedItem?.name ?? 'item'}?`}
        description={
          kind === 'skills'
            ? 'This permanently removes the skill folder and its files.'
            : 'This permanently removes the file.'
        }
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />

      <ConfirmDialog
        open={migrateItem !== null}
        onOpenChange={(open) => {
          if (!open) setMigrateItem(null)
        }}
        title={`Migrate "${migrateItem?.name ?? 'item'}" to a ${
          migrateKind
            ? COLLECTION_LABELS[migrateKind].singular.toLowerCase()
            : 'item'
        }?`}
        description={
          kind === 'skills'
            ? `This creates the command "${migrateItem?.id}" from the skill's instructions and then deletes the skill folder. Files bundled with the skill are not carried over.`
            : `This creates the skill "${migrateItem?.id}" from this command and then deletes the command file.`
        }
        confirmLabel="Migrate"
        onConfirm={() => {
          const pending = migrateItem
          setMigrateItem(null)
          if (pending) void runMigrate(pending)
        }}
      />

      <NameDialog
        key={`rename-${renameItem?.id ?? 'none'}`}
        open={renameItem !== null}
        title={`Rename "${renameItem?.name ?? ''}"`}
        initial={renameItem?.id ?? ''}
        confirmLabel="Rename"
        placeholder="new-id"
        onOpenChange={(open) => {
          if (!open) setRenameItem(null)
        }}
        onConfirm={(toId) => {
          const pending = renameItem
          setRenameItem(null)
          if (pending) void runRename(pending, toId)
        }}
      />

      <NameDialog
        key={`dup-${duplicateItem?.id ?? 'none'}`}
        open={duplicateItem !== null}
        title={`Duplicate "${duplicateItem?.name ?? ''}"`}
        initial={duplicateItem ? `${duplicateItem.id}-copy` : ''}
        confirmLabel="Duplicate"
        placeholder="new-id"
        onOpenChange={(open) => {
          if (!open) setDuplicateItem(null)
        }}
        onConfirm={(newId) => {
          const pending = duplicateItem
          setDuplicateItem(null)
          if (pending) void runDuplicate(pending, newId)
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} ${labels.plural.toLowerCase()}?`}
        description="This permanently removes the selected items from disk."
        confirmLabel="Delete"
        onConfirm={() => void doBulkDelete()}
      />

      {migrateKind && (
        <ConfirmDialog
          open={bulkMigrateOpen}
          onOpenChange={setBulkMigrateOpen}
          title={`Migrate ${selected.size} to ${COLLECTION_LABELS[migrateKind].plural}?`}
          description={`Each selected item is converted to a ${COLLECTION_LABELS[
            migrateKind
          ].singular.toLowerCase()} and removed from here. Name clashes are skipped.`}
          confirmLabel="Migrate"
          destructive={false}
          onConfirm={() => void doBulkMigrate()}
        />
      )}

      <FileHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        filePath={filePath}
        current={original}
        onRestored={() => void reloadFromDisk()}
      />

      <ConfirmDialog
        open={pendingSelectId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSelectId(null)
        }}
        title="Discard unsaved changes?"
        description={`You have unsaved edits on "${selectedItem?.name ?? 'this item'}". Opening another item will discard them.`}
        confirmLabel="Discard"
        onConfirm={() => {
          const next = pendingSelectId
          setPendingSelectId(null)
          if (next) setSelectedId(next)
        }}
      />

      <UnsavedGuard dirty={dirty} />
    </div>
  )
}
