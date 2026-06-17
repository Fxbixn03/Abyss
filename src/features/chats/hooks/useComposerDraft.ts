import { useCallback, useEffect, useRef } from 'react'
import { useComposerDraftsStore } from '../store/composerDrafts.store'

const DEBOUNCE_MS = 300

/**
 * Provides draft persistence for the Composer textarea, backed by a Zustand
 * persist store keyed by `draftKey` (a sessionId or `'new'`).
 *
 * Returns:
 * - `initialText`: the stored draft for this key (read once on mount).
 * - `saveDraft`: debounced write — call on every change event.
 * - `clearDraft`: call after a successful submit to remove the stored draft.
 */
export function useComposerDraft(draftKey: string) {
  const drafts = useComposerDraftsStore((s) => s.drafts)
  const setDraft = useComposerDraftsStore((s) => s.setDraft)
  const clearDraftStore = useComposerDraftsStore((s) => s.clearDraft)

  // Snapshot the initial text for this key. We only want the value at mount
  // time (when `draftKey` first resolves) — subsequent store changes are not
  // relevant to the initial-text concern.
  const initialText = drafts[draftKey] ?? ''

  // Debounce timer ref — persists across renders without causing re-renders.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel any pending debounce on unmount to avoid writing stale drafts.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const saveDraft = useCallback(
    (text: string) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setDraft(draftKey, text)
        timerRef.current = null
      }, DEBOUNCE_MS)
    },
    [draftKey, setDraft],
  )

  const clearDraft = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    clearDraftStore(draftKey)
  }, [draftKey, clearDraftStore])

  return { initialText, saveDraft, clearDraft }
}
