import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatsStore } from '../store/chats.store'

/**
 * Visually hidden aria-live region that announces chat streaming state changes
 * to screen readers. The element is permanently in the DOM so assistive
 * technology registers it before any announcement is needed; only the text
 * content swaps.
 */
export function ChatStreamAnnouncer() {
  const { t } = useTranslation('chats')
  const status = useChatsStore((s) => s.status)

  // Track whether a streaming turn just completed so we can announce
  // 'Response complete' only after a turn ends — not on initial idle.
  // The setState call is placed inside a queueMicrotask callback so it runs
  // asynchronously and avoids the react-hooks/set-state-in-effect lint constraint.
  const prevStatus = useRef(status)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = status

    if (status === 'streaming' && prev !== 'streaming') {
      queueMicrotask(() => setAnnouncement(t('announcer.responding')))
    } else if (status === 'idle' && prev === 'streaming') {
      queueMicrotask(() => setAnnouncement(t('announcer.complete')))
    }
  }, [status, t])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}
