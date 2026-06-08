import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GeminiCommandSummary } from '@/shared/types/gemini-command'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { NameDialog } from '@/shared/components/NameDialog'
import { Icon } from '@/shared/components/Icon'
import { useFileWatch } from '@/shared/hooks/useFileWatch'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { CommandEditor } from '../components/CommandEditor'
import { defaultTemplate, parseToml } from '../lib/toml'

export function GeminiCommandsPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()

  const [items, setItems] = useState<GeminiCommandSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [raw, setRaw] = useState('')
  const [savedRaw, setSavedRaw] = useState('')
  // Last parseable text, so the form keeps its fields during a transient TOML
  // syntax error (the editor renders this read-only until the error is fixed).
  const [lastValidRaw, setLastValidRaw] = useState('')
  const [filePath, setFilePath] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [newOpen, setNewOpen] = useState(false)
  const [renameItem, setRenameItem] = useState<GeminiCommandSummary | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Reload the list after our own create/save/delete/rename.
  const reloadList = useCallback(async () => {
    if (!basePath) return
    setItems(await ipc.listGeminiCommands(basePath))
  }, [basePath])

  // Initial / basePath-driven load. setState lives in the promise callback so it
  // doesn't trip react-hooks set-state-in-effect.
  useEffect(() => {
    if (!basePath) return
    let active = true
    void ipc.listGeminiCommands(basePath).then((list) => {
      if (!active) return
      setItems(list)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [basePath])

  const applyLoaded = useCallback((content: string, path: string) => {
    setRaw(content)
    setSavedRaw(content)
    setLastValidRaw(parseToml(content).error ? '' : content)
    setFilePath(path)
  }, [])

  const loadItem = useCallback(
    async (id: string) => {
      if (!basePath) return
      const { raw: content, path } = await ipc.readGeminiCommand(basePath, id)
      applyLoaded(content, path)
    },
    [basePath, applyLoaded],
  )

  // Load the selected command's TOML. setState stays inside the promise.
  useEffect(() => {
    if (!selectedId || !basePath) return
    let active = true
    void ipc.readGeminiCommand(basePath, selectedId).then(({ raw: c, path }) => {
      if (active) applyLoaded(c, path)
    })
    return () => {
      active = false
    }
  }, [selectedId, basePath, applyLoaded])

  // Reload the open file when it changes on disk (only if we have no edits).
  const onExternalChange = useCallback(() => {
    if (selectedId && raw === savedRaw) void loadItem(selectedId)
  }, [selectedId, raw, savedRaw, loadItem])
  useFileWatch(filePath, onExternalChange)

  // Track the edited text; remember it as last-valid whenever it parses.
  const handleChange = (next: string) => {
    setRaw(next)
    if (!parseToml(next).error) setLastValidRaw(next)
  }

  const save = async () => {
    if (!basePath || !selectedId) return
    await ipc.writeGeminiCommand(basePath, selectedId, raw)
    setSavedRaw(raw)
    await reloadList()
  }

  const createNew = async (id: string) => {
    setNewOpen(false)
    if (!basePath) return
    setError(null)
    try {
      const content = defaultTemplate(id)
      const { path } = await ipc.writeGeminiCommand(basePath, id, content)
      await reloadList()
      setSelectedId(id)
      applyLoaded(content, path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create command.')
    }
  }

  const rename = async (toId: string) => {
    const item = renameItem
    setRenameItem(null)
    if (!basePath || !item || toId === item.id) return
    setError(null)
    try {
      await ipc.renameGeminiCommand(basePath, item.id, toId)
      await reloadList()
      if (selectedId === item.id) setSelectedId(toId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename command.')
    }
  }

  const confirmDelete = async () => {
    const id = deleteId
    setDeleteId(null)
    if (!basePath || !id) return
    await ipc.deleteGeminiCommand(basePath, id)
    if (selectedId === id) {
      setSelectedId(null)
      setRaw('')
      setSavedRaw('')
      setLastValidRaw('')
      setFilePath('')
    }
    await reloadList()
  }

  const header = (
    <PageHeader
      title="Commands"
      description={`Custom slash commands for ${agent.displayName}`}
      icon="square-slash"
      actions={
        basePath ? (
          <Button onClick={() => setNewOpen(true)}>
            <Icon name="file-plus" />
            New Command
          </Button>
        ) : undefined
      }
    />
  )

  if (!basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        {header}
        <EmptyState
          icon="folder"
          title="No config location set"
          description="Set a Gemini config directory in Settings to manage commands."
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

  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q),
      )
    : items

  return (
    <div className="flex h-full flex-col gap-4">
      {header}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="flex items-center gap-2">
            <Icon name="circle-alert" className="size-4 shrink-0" />
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
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
              placeholder="Filter commands…"
            />
          )}
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {!loaded ? (
              <p className="px-1 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">
                No commands yet.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((item) => {
                const active = item.id === selectedId
                return (
                  <ContextMenu key={item.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          'flex min-w-0 flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors',
                          active
                            ? 'border-primary/50 bg-accent'
                            : 'border-transparent hover:bg-accent/60',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon
                            name="square-slash"
                            className="size-4 text-muted-foreground"
                          />
                          <span className="truncate">{item.name}</span>
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
                        onSelect={() => void ipc.revealPath(item.path)}
                      >
                        <Icon name="folder-open" />
                        Reveal in folder
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteId(item.id)}
                      >
                        <Icon name="trash" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })
            )}
          </div>
        </aside>

        <section className="min-h-0 rounded-lg border border-border bg-card/40 p-4">
          {!selectedId ? (
            <EmptyState
              icon="square-slash"
              title="No command selected"
              description="Pick a command to edit, or create a new one."
            />
          ) : (
            <CommandEditor
              value={raw}
              savedValue={savedRaw}
              lastValidValue={lastValidRaw}
              onChange={handleChange}
              onSave={() => void save()}
            />
          )}
        </section>
      </div>

      {newOpen && (
        <NameDialog
          open
          title="New command"
          confirmLabel="Create"
          placeholder="git/commit"
          onOpenChange={setNewOpen}
          onConfirm={(id) => void createNew(id)}
        />
      )}

      {renameItem && (
        <NameDialog
          key={renameItem.id}
          open
          title="Rename command"
          initial={renameItem.id}
          confirmLabel="Rename"
          placeholder="git/commit"
          onOpenChange={(open) => !open && setRenameItem(null)}
          onConfirm={(id) => void rename(id)}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete command?"
        description={`This permanently deletes "${deleteId}.toml".`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
