import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/shared/types/chat'
import { EmptyState } from '@/shared/components/EmptyState'
import { MessageBubble } from './MessageBubble'

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

  // Track whether the user is pinned near the bottom; only autoscroll if so.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    bottomLocked.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    if (bottomLocked.current) {
      endRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages])

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
  )
}
