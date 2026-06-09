import { useCallback, useEffect, useState } from 'react'
import type { CollectionKind } from '@/shared/types/collections'
import { ipc } from '@/shared/ipc/ipc.client'
import { useFileWatch } from '@/shared/hooks/useFileWatch'

/**
 * Read / edit / save one markdown collection item (subagent / command / skill /
 * rule) from the relations inspector. A slim cousin of `useCollectionManager`:
 * just the single-file editing path, reusing the existing collection IPC.
 *
 * We deliberately do NOT trigger a graph rebuild after saving — the page's file
 * watch (debounced) picks up our own write and rebuilds exactly once, so edges
 * refresh without a double rebuild.
 */
export function useNodeEditor(
  agentId: string,
  basePath: string,
  kind: CollectionKind | undefined,
  itemId: string | undefined,
) {
  const [original, setOriginal] = useState('')
  const [draft, setDraft] = useState('')
  const [filePath, setFilePath] = useState('')
  const [saving, setSaving] = useState(false)
  const [externalChanged, setExternalChanged] = useState(false)

  const editable = Boolean(kind && itemId && basePath)

  // Load the selected item. setState lives only in the async callback so it's
  // never called synchronously inside the effect. A non-editable selection
  // simply skips loading — the inspector hides the editor, and the stale draft
  // is invisible (the "unsaved" badge is gated on `editable`).
  useEffect(() => {
    if (!kind || !itemId || !basePath) return
    let active = true
    void ipc.readCollectionItem(agentId, basePath, kind, itemId).then((r) => {
      if (!active) return
      setOriginal(r.content)
      setDraft(r.content)
      setFilePath(r.path)
      setExternalChanged(false)
    })
    return () => {
      active = false
    }
  }, [agentId, basePath, kind, itemId])

  const dirty = draft !== original

  const save = async () => {
    if (!kind || !itemId || !basePath || !dirty) return
    setSaving(true)
    try {
      await ipc.writeCollectionItem(agentId, basePath, kind, itemId, draft)
      setOriginal(draft)
    } finally {
      setSaving(false)
    }
  }

  const reloadFromDisk = async () => {
    if (!kind || !itemId || !basePath) return
    const r = await ipc.readCollectionItem(agentId, basePath, kind, itemId)
    setOriginal(r.content)
    setDraft(r.content)
    setExternalChanged(false)
  }

  // Flag (don't clobber) external edits to the open file.
  const onExternal = useCallback(async () => {
    if (!kind || !itemId || !basePath) return
    const r = await ipc.readCollectionItem(agentId, basePath, kind, itemId)
    if (r.content !== original) setExternalChanged(true)
  }, [agentId, basePath, kind, itemId, original])
  useFileWatch(filePath, onExternal)

  return {
    editable,
    draft,
    setDraft,
    original,
    dirty,
    saving,
    filePath,
    externalChanged,
    setExternalChanged,
    save,
    reloadFromDisk,
  }
}
