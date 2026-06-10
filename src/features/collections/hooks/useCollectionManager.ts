import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CollectionItem,
  CollectionKind,
  SkillCollisionMode,
} from '@/shared/types/collections'
import { collectionLabel } from '@/shared/agents/defs'
import { useFileWatch } from '@/shared/hooks/useFileWatch'
import { ipc } from '@/shared/ipc/ipc.client'
import {
  useActiveAgent,
  useActiveAgentId,
} from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { useCollectionSelection } from '../store/collectionSelection.store'
import type { DiscoveredAgentSpec } from '@/shared/agents/discovery'
import { agentSpecToSubagent } from '@/shared/agents/discovery'

export interface CollectionNotice {
  type: 'success' | 'error'
  message: string
}

/** Ordering for the item list. */
export type CollectionSort = 'name' | 'model' | 'recent'

export const COLLECTION_SORTS: { id: CollectionSort; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'model', label: 'Model' },
  { id: 'recent', label: 'Recently edited' },
]

interface SkillCollision {
  archivePath: string
  existingId: string
  suggestedId: string
}

/**
 * All state, effects and actions behind a {@link CollectionKind} manager
 * (skills / commands / subagents / rules). Extracted from the page component so
 * the view layer is just presentation; the returned controller is passed to the
 * list / editor / dialog subcomponents as a single `cm` prop.
 */
export function useCollectionManager(kind: CollectionKind, icon: string) {
  const agent = useActiveAgent()
  const agentId = useActiveAgentId()
  const basePath = useConfigBase(agentId)
  const confirmDiff = useSettingsStore((s) => s.settings.confirmDiffBeforeSave)
  const labels = collectionLabel(agentId, kind)
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
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Item targeted by the right-click "Migrate" action, awaiting confirmation.
  const [migrateItem, setMigrateItem] = useState<CollectionItem | null>(null)
  const [renameItem, setRenameItem] = useState<CollectionItem | null>(null)
  const [duplicateItem, setDuplicateItem] = useState<CollectionItem | null>(
    null,
  )
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<CollectionSort>('name')
  const [externalChanged, setExternalChanged] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkMigrateOpen, setBulkMigrateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Skill import (from a downloaded `.skill` archive).
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<CollectionNotice | null>(null)
  const [collision, setCollision] = useState<SkillCollision | null>(null)

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
    const list = await ipc.listCollection(agentId, basePath, kind)
    setItems(list)
    setLoaded(true)
  }, [agentId, supported, basePath, kind])

  // Initial / dependency-driven load. Inlined (setState inside the promise
  // callback) so it doesn't trip react-hooks set-state-in-effect.
  useEffect(() => {
    if (!supported || !basePath) return
    let active = true
    void ipc.listCollection(agentId, basePath, kind).then((list) => {
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
  }, [agentId, supported, basePath, kind])

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
    void ipc
      .readCollectionItem(agentId, basePath, kind, selectedId)
      .then((r) => {
        if (!active) return
        setOriginal(r.content)
        setDraft(r.content)
        setFilePath(r.path)
      })
    return () => {
      active = false
    }
  }, [agentId, selectedId, basePath, kind])

  // Plain functions, not useCallback: `agentId` is needed inside but the
  // React Compiler lint can't reconcile it as a manual dependency here. The
  // keydown handler below reads the latest `requestSave` via a ref, so neither
  // needs a stable identity.
  const performSave = async () => {
    if (!basePath || !selectedId) return
    setSaving(true)
    await ipc.writeCollectionItem(agentId, basePath, kind, selectedId, draft)
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

  // Detect external edits to the open item and offer a reload.
  const onExternal = useCallback(async () => {
    if (!basePath || !selectedId) return
    const r = await ipc.readCollectionItem(agentId, basePath, kind, selectedId)
    if (r.content !== original) setExternalChanged(true)
  }, [agentId, basePath, kind, selectedId, original])
  useFileWatch(filePath, onExternal)

  const reloadFromDisk = async () => {
    if (!basePath || !selectedId) return
    const r = await ipc.readCollectionItem(agentId, basePath, kind, selectedId)
    setOriginal(r.content)
    setDraft(r.content)
    setExternalChanged(false)
  }

  // Keep a live ref to the latest save handler so the keydown listener can stay
  // mounted once (its deps are empty) yet always call the current closure.
  const requestSaveRef = useRef(requestSave)
  useEffect(() => {
    requestSaveRef.current = requestSave
  })

  // Cmd/Ctrl+S saves the open item, matching the instructions editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        requestSaveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const create = async (id: string, content: string) => {
    if (!basePath) return
    await ipc.writeCollectionItem(agentId, basePath, kind, id, content)
    await refresh()
    setSelectedId(id)
  }

  // Save an agent found via Discover as a local subagent stub, then open it.
  const saveDiscovered = async (spec: DiscoveredAgentSpec) => {
    const { id, content } = agentSpecToSubagent(
      spec,
      items.map((i) => i.id),
    )
    await create(id, content)
    setNotice({
      type: 'success',
      message: `Saved "${spec.name}" as a subagent.`,
    })
  }

  const remove = async () => {
    if (!basePath || !selectedId) return
    await ipc.deleteCollectionItem(agentId, basePath, kind, selectedId)
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
      const r = await ipc.renameCollectionItem(
        agentId,
        basePath,
        kind,
        item.id,
        toId,
      )
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
        agentId,
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
    for (const id of ids)
      await ipc.deleteCollectionItem(agentId, basePath, kind, id)
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
        await ipc.migrateCollectionItem(
          agentId,
          basePath,
          kind,
          migrateKind,
          id,
        )
        moved += 1
      } catch {
        // skip items that can't migrate (e.g. name clash)
      }
    }
    if (selectedId && ids.includes(selectedId)) setSelectedId(null)
    clearSelected()
    setNotice({
      type: 'success',
      message: `Migrated ${moved} of ${ids.length} to ${collectionLabel(agentId, migrateKind).plural}.`,
    })
    void refresh()
  }

  const runExport = async (item: CollectionItem) => {
    if (!basePath) return
    setNotice(null)
    try {
      const { path } = await ipc.exportCollectionItem(
        agentId,
        basePath,
        kind,
        item.id,
      )
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
      await ipc.migrateCollectionItem(
        agentId,
        basePath,
        kind,
        migrateKind,
        item.id,
      )
      if (selectedId === item.id) {
        setSelectedId(null)
        setOriginal('')
        setDraft('')
        setFilePath('')
      }
      setNotice({
        type: 'success',
        message: `Migrated "${item.name}" to a ${collectionLabel(
          agentId,
          migrateKind,
        ).singular.toLowerCase()} — find it on the ${
          collectionLabel(agentId, migrateKind).plural
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

  const selectedItem = items.find((i) => i.id === selectedId) ?? null

  const q = query.trim().toLowerCase()
  const matched = q
    ? items.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q),
      )
    : items
  const filtered = [...matched].sort((a, b) => {
    if (sortBy === 'recent') return (b.mtime ?? 0) - (a.mtime ?? 0)
    if (sortBy === 'model') {
      const cmp = (a.model ?? '').localeCompare(b.model ?? '')
      if (cmp !== 0) return cmp
    }
    return a.name.localeCompare(b.name)
  })

  return {
    // Identity / capabilities
    agent,
    agentId,
    kind,
    icon,
    labels,
    supported,
    basePath,
    migrateKind,
    canMigrate,
    // List state
    items,
    filtered,
    loaded,
    query,
    setQuery,
    selectedId,
    setSelectedId,
    selectedItem,
    requestSelect,
    sortBy,
    setSortBy,
    selected,
    toggleSelected,
    clearSelected,
    // Editor state
    draft,
    setDraft,
    original,
    dirty,
    saving,
    filePath,
    externalChanged,
    setExternalChanged,
    requestSave,
    performSave,
    reloadFromDisk,
    // Notice
    notice,
    setNotice,
    importing,
    // Dialog open state
    newOpen,
    setNewOpen,
    discoverOpen,
    setDiscoverOpen,
    deleteOpen,
    setDeleteOpen,
    diffOpen,
    setDiffOpen,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkMigrateOpen,
    setBulkMigrateOpen,
    historyOpen,
    setHistoryOpen,
    pendingSelectId,
    setPendingSelectId,
    migrateItem,
    setMigrateItem,
    renameItem,
    setRenameItem,
    duplicateItem,
    setDuplicateItem,
    collision,
    setCollision,
    // Actions
    create,
    saveDiscovered,
    remove,
    runRename,
    runDuplicate,
    doBulkDelete,
    doBulkMigrate,
    runExport,
    runMigrate,
    runImport,
    startImport,
  }
}

export type CollectionController = ReturnType<typeof useCollectionManager>
