import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CollectionItem, CollectionKind } from '@/shared/types/collections'
import { COLLECTION_LABELS } from '@/shared/types/collections'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { ConfigEditor } from '@/features/config/components/ConfigEditor'
import { DiffPreviewDialog } from '@/features/config/components/DiffPreviewDialog'
import { NewItemDialog } from './NewItemDialog'
import { buildTemplate } from '../lib/templates'

export interface CollectionManagerProps {
  kind: CollectionKind
  icon: string
}

export function CollectionManager({ kind, icon }: CollectionManagerProps) {
  const agent = useActiveAgent()
  const basePath = useBasePath(agent.id)
  const navigate = useNavigate()
  const confirmDiff = useSettingsStore((s) => s.settings.confirmDiffBeforeSave)
  const labels = COLLECTION_LABELS[kind]
  const supported = agent.capabilities[kind]

  const [items, setItems] = useState<CollectionItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [original, setOriginal] = useState('')
  const [draft, setDraft] = useState('')
  const [filePath, setFilePath] = useState('')
  const [saving, setSaving] = useState(false)

  const [diffOpen, setDiffOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const dirty = draft !== original

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
    })
    return () => {
      active = false
    }
  }, [supported, basePath, kind])

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

  const performSave = async () => {
    if (!basePath || !selectedId) return
    setSaving(true)
    await ipc.writeCollectionItem(basePath, kind, selectedId, draft)
    setOriginal(draft)
    setSaving(false)
    setDiffOpen(false)
    void refresh()
  }

  const requestSave = () => {
    if (!dirty) return
    if (confirmDiff) setDiffOpen(true)
    else void performSave()
  }

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

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={labels.plural}
        description={`${labels.plural} for ${agent.displayName}`}
        icon={icon}
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Icon name="file-plus" />
            New {labels.singular}
          </Button>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-4">
        <aside className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1">
          {!loaded ? (
            <p className="px-1 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              No {labels.plural.toLowerCase()} yet.
            </p>
          ) : (
            items.map((item) => {
              const active = item.id === selectedId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-primary/50 bg-accent'
                      : 'border-transparent hover:bg-accent/60',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon name={icon} className="size-4 text-muted-foreground" />
                    <span className="truncate">{item.name}</span>
                    {item.model && (
                      <Badge variant="muted" className="ml-auto font-code">
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
              )
            })
          )}
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

              <div className="min-h-0 flex-1">
                <ConfigEditor
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
        onCreate={(values) => void create(values.id, buildTemplate(kind, values))}
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
    </div>
  )
}
