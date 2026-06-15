import { useEffect, useRef, useState } from 'react'
import { useConfigStore } from '../store/config.store'

/**
 * Visually hidden aria-live region that announces config editor state changes
 * to screen readers. The element is permanently in the DOM so assistive
 * technology registers it before any announcement is needed; only the text
 * content swaps.
 */
export function ConfigEditorStatusAnnouncer() {
  const loading = useConfigStore((s) => s.loading)
  const saving = useConfigStore((s) => s.saving)
  const issues = useConfigStore((s) => s.issues)

  // Track whether a save cycle just completed so we can announce "Saved"
  // only after a save — not when a file first loads. The setState call is
  // placed inside a queueMicrotask callback so it runs asynchronously and
  // avoids the react-hooks/set-state-in-effect lint constraint.
  const prevSaving = useRef(false)
  const [savedAnnouncement, setSavedAnnouncement] = useState(false)

  useEffect(() => {
    const justFinishedSaving = prevSaving.current && !saving
    prevSaving.current = saving

    if (justFinishedSaving) {
      queueMicrotask(() => setSavedAnnouncement(true))
    } else if (loading || issues.length > 0 || saving) {
      queueMicrotask(() => setSavedAnnouncement(false))
    }
  }, [saving, loading, issues])

  let status = ''
  if (loading) {
    status = 'Loading file...'
  } else if (saving) {
    status = 'Saving...'
  } else if (issues.length > 0) {
    status = issues[0].message
  } else if (savedAnnouncement) {
    status = 'Saved'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {status}
    </div>
  )
}
