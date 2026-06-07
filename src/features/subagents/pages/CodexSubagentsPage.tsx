import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CodexSubagentSummary } from '@/shared/types/codex-subagent'
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
import { SubagentEditor } from '../components/SubagentEditor'
import { defaultTemplate, parseToml } from '../lib/toml'

export function CodexSubagentsPage() {
  const agent = useActiveAgent()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()

  const [items, setItems] = useState<CodexSubagentSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [raw, setRaw] = useState('')
  const [savedRaw, setSavedRaw] = useState('')
  // Last parseable text, so the form keeps its fields during a transient TOML
  // syntax error (the editor renders this read-only until the error is fixed).
  const [lastValidRaw, setLastValidRaw] = useState('')
  const [filePath, setFilePath] = useState('')

  const [newOpen, setNewOpen] = useState(false)
  const [renameItem, setRenameItem] = useState<CodexSubagentSummary | null>(
    null,
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Reload the list after our own create/save/delete/rename (handler-only, so
  // direct setState is fine here — unlike inside an effect body).
  const reloadList = useCallback(async () => {
    if (!basePath) return
    setItems(await ipc.listCodexSubagents(basePath))
  }, [basePath])

  // Initial / basePath-driven load. setState lives in the promise callback so it
  // doesn't trip react-hooks set-state-in-effect.
  useEffect(() => {
    if (!basePath) return
    let active = true
    void ipc.listCodexSubagents(basePath).then((list) => {
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
      const { raw: content, path } = await ipc.readCodexSubagent(basePath, id)
      applyLoaded(content, path)
    },
    [basePath, applyLoaded],
  )

  // Load the selected subagent's TOML. setState stays inside the promise.
  useEffect(() => {
    if (!selectedId || !basePath) return
    let active = true
    void ipc.readCodexSubagent(basePath, selectedId).then(({ raw: c, path }) => {
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
    await ipc.writeCodexSubagent(basePath, selectedId, raw)
    setSavedRaw(raw)
    await reloadList()
  }

  const createNew = async (name: string) => {
    setNewOpen(false)
    if (!basePath) return
    const content = defaultTemplate(name)
    const { path } = await ipc.writeCodexSubagent(basePath, name, content)
    await reloadList()
    setSelectedId(name)
    applyLoaded(content, path)
  }

  const rename = async (toId: string) => {
    const item = renameItem
    setRenameItem(null)
    if (!basePath || !item || toId === item.id) return
    await ipc.renameCodexSubagent(basePath, item.id, toId)
    await reloadList()
    if (selectedId === item.id) setSelectedId(toId)
  }

  const confirmDelete = async () => {
    const id = deleteId
    setDeleteId(null)
    if (!basePath || !id) return
    await ipc.deleteCodexSubagent(basePath, id)
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
      title="Subagents"
      description={`Custom subagents for ${agent.displayName}`}
      icon="bot"
      actions={
        basePath ? (
          <Button onClick={() => setNewOpen(true)}>
            <Icon name="file-plus" />
            New Subagent
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
          description="Set a Codex config directory in Settings to manage subagents."
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

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-4">
        <aside className="flex min-h-0 flex-col gap-2">
          {items.length > 0 && (
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter subagents…"
            />
          )}
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {!loaded ? (
              <p className="px-1 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">
                No subagents yet.
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
                            name="bot"
                            className="size-4 text-muted-foreground"
                          />
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
              icon="bot"
              title="No subagent selected"
              description="Pick a subagent to edit, or create a new one."
            />
          ) : (
            <SubagentEditor
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
          title="New subagent"
          confirmLabel="Create"
          placeholder="reviewer"
          onOpenChange={setNewOpen}
          onConfirm={(name) => void createNew(name)}
        />
      )}

      {renameItem && (
        <NameDialog
          key={renameItem.id}
          open
          title="Rename subagent"
          initial={renameItem.id}
          confirmLabel="Rename"
          onOpenChange={(open) => !open && setRenameItem(null)}
          onConfirm={(name) => void rename(name)}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete subagent?"
        description={`This permanently deletes "${deleteId}.toml".`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
