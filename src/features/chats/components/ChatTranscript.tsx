import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/shared/types/chat'
import { EmptyState } from '@/shared/components/EmptyState'
import { MessageBubble } from './MessageBubble'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'

export function ChatTranscript({
  messages,
  loading,
  agentName,
}: {
  messages: ChatMessage[]
  loading: boolean
  agentName?: string
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const bottomLocked = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Whether the user has scrolled more than one viewport height from the top.
  const [showJumpTop, setShowJumpTop] = useState(false)
  // Whether the user is NOT at the bottom (bottomLocked === false).
  const [showJumpBottom, setShowJumpBottom] = useState(false)

  // Track whether the user is pinned near the bottom; only autoscroll if so.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    bottomLocked.current = isNearBottom
    setShowJumpBottom(!isNearBottom)
    setShowJumpTop(el.scrollTop > el.clientHeight)
  }

  useEffect(() => {
    if (bottomLocked.current) {
      endRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages])

  const jumpToTop = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: 'smooth' })
    bottomLocked.current = false
    setShowJumpBottom(true)
    setShowJumpTop(false)
  }

  const jumpToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    bottomLocked.current = true
    setShowJumpBottom(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading transcript…
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon="messages-square"
        title="No messages yet"
        description="Type below to start the conversation."
      />
    )
  }

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        // data-selectable opts this surface out of the app-wide user-select:none
        // so conversation text can be highlighted and copied.
        data-selectable
        className="flex h-full flex-col gap-5 overflow-y-auto px-1 py-2"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} agentName={agentName} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Floating jump buttons anchored to the bottom-right of the scroll container */}
      {(showJumpTop || showJumpBottom) && (
        <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col gap-1">
          {showJumpTop && (
            <Button
              size="icon"
              variant="outline"
              aria-label="Jump to top"
              title="Jump to top"
              className="pointer-events-auto shadow-md"
              onClick={jumpToTop}
            >
              <Icon name="arrow-up" className="size-4" />
            </Button>
          )}
          {showJumpBottom && (
            <Button
              size="icon"
              variant="outline"
              aria-label="Jump to bottom"
              title="Jump to bottom"
              className="pointer-events-auto shadow-md"
              onClick={jumpToBottom}
            >
              <Icon name="arrow-down" className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
