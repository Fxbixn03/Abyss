import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '@/shared/types/chat'
import { EmptyState } from '@/shared/components/EmptyState'
import { MessageBubble } from './MessageBubble'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { scrollBehavior } from '@/shared/lib/motion'

/** Skeleton placeholder for a single bubble row while the transcript loads. */
function SkeletonBubbleRow({
  role,
  bars,
}: {
  role: 'user' | 'assistant'
  bars: string[]
}) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      {/* Avatar placeholder */}
      <div className="mt-0.5 size-6 shrink-0 rounded bg-muted/60" />
      {/* Content bars */}
      <div
        className={cn(
          'flex flex-col gap-1.5',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {bars.map((width, i) => (
          <div
            key={i}
            className={cn('h-3 animate-pulse rounded-full bg-muted/60', width)}
          />
        ))}
      </div>
    </div>
  )
}

/** Four skeleton rows mimicking the real bubble layout, shown while loading. */
function TranscriptSkeleton() {
  return (
    <div className="flex h-full flex-col gap-5 px-1 py-2">
      <SkeletonBubbleRow role="user" bars={['w-36', 'w-24']} />
      <SkeletonBubbleRow
        role="assistant"
        bars={['w-64', 'w-80', 'w-48']}
      />
      <SkeletonBubbleRow role="user" bars={['w-28']} />
      <SkeletonBubbleRow
        role="assistant"
        bars={['w-72', 'w-56']}
      />
    </div>
  )
}

/** Extract all plain text from a message's text blocks. */
function extractText(message: ChatMessage): string {
  return message.blocks
    .filter((b): b is Extract<typeof b, { kind: 'text' }> => b.kind === 'text')
    .map((b) => b.text)
    .join(' ')
}

export function ChatTranscript({
  messages,
  loading,
  agentName,
  streaming,
  searchOpen: searchOpenProp,
  onSearchOpenChange,
}: {
  messages: ChatMessage[]
  loading: boolean
  agentName?: string
  /** When true, the last message renders with a blinking typing cursor. */
  streaming?: boolean
  /** Controlled open state from the parent (optional). */
  searchOpen?: boolean
  /** Callback when the search bar is opened/closed internally. */
  onSearchOpenChange?: (open: boolean) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const bottomLocked = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<(HTMLDivElement | null)[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Whether the user has scrolled more than one viewport height from the top.
  const [showJumpTop, setShowJumpTop] = useState(false)
  // Whether the user is NOT at the bottom (bottomLocked === false).
  const [showJumpBottom, setShowJumpBottom] = useState(false)

  // Search state — all local
  const [searchOpenInternal, setSearchOpenInternal] = useState(false)
  const [query, setQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)

  // Controlled or uncontrolled search open
  const searchOpen = searchOpenProp ?? searchOpenInternal

  const setSearchOpen = useCallback(
    (open: boolean) => {
      if (searchOpenProp === undefined) {
        setSearchOpenInternal(open)
      }
      onSearchOpenChange?.(open)
    },
    [searchOpenProp, onSearchOpenChange],
  )

  // Compute match indices whenever query or messages change (memoised to keep the
  // array reference stable so the scroll useEffect only re-fires when needed).
  const matchIndices = useMemo(() => {
    if (query.trim() === '') return []
    const lower = query.toLowerCase()
    return messages.reduce<number[]>((acc, msg, i) => {
      if (extractText(msg).toLowerCase().includes(lower)) acc.push(i)
      return acc
    }, [])
  }, [query, messages])

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

  // When searchOpen becomes true, focus the input
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [searchOpen])

  // Scroll to the active match
  useEffect(() => {
    if (matchIndices.length === 0) return
    const idx = matchIndices[activeMatch]
    if (idx === undefined) return
    const el = messageRefs.current[idx]
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
    }
  }, [activeMatch, matchIndices])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
  }, [setSearchOpen])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setActiveMatch(0)
  }, [setSearchOpen])

  const jumpToTop = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: scrollBehavior() })
    bottomLocked.current = false
    setShowJumpBottom(true)
    setShowJumpTop(false)
  }

  const jumpToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() })
    bottomLocked.current = true
    setShowJumpBottom(false)
  }

  const goToPrev = () => {
    if (matchIndices.length === 0) return
    setActiveMatch((i) => (i - 1 + matchIndices.length) % matchIndices.length)
  }

  const goToNext = () => {
    if (matchIndices.length === 0) return
    setActiveMatch((i) => (i + 1) % matchIndices.length)
  }

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      openSearch()
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closeSearch()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPrev()
      } else {
        goToNext()
      }
    }
  }

  if (loading) {
    return <TranscriptSkeleton />
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
      role="region"
      aria-label="Chat transcript"
      tabIndex={-1}
      className="relative h-full"
      onKeyDown={handleContainerKeyDown}
    >
      {/* Search bar overlay */}
      {searchOpen && (
        <div role="search" className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur-sm">
          <Icon name="search" className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveMatch(0)
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search messages…"
            className="h-7 flex-1 border-none bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
            aria-label="Search messages"
          />
          <span
            className="shrink-0 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {query.trim() === '' ? '' : matchIndices.length === 0
              ? 'No results'
              : `${activeMatch + 1} / ${matchIndices.length}`}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={goToPrev}
            disabled={matchIndices.length === 0}
            aria-label="Previous match"
            title="Previous match"
          >
            <Icon name="chevron-up" className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={goToNext}
            disabled={matchIndices.length === 0}
            aria-label="Next match"
            title="Next match"
          >
            <Icon name="chevron-down" className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={closeSearch}
            aria-label="Close search"
            title="Close search"
          >
            <Icon name="x" className="size-3.5" />
          </Button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        // data-selectable opts this surface out of the app-wide user-select:none
        // so conversation text can be highlighted and copied.
        data-selectable
        aria-label="Messages"
        className={cn(
          'flex h-full flex-col gap-5 overflow-y-auto px-1 py-2',
          searchOpen && 'pt-11',
        )}
      >
        {messages.map((m, i) => {
          const matchPos = matchIndices.indexOf(i)
          const isMatch = matchPos !== -1
          const isActive = isMatch && matchPos === activeMatch
          return (
            <div
              key={m.id}
              ref={(el) => {
                messageRefs.current[i] = el
              }}
              className={cn(
                'motion-safe:animate-bubble-in',
                isMatch && 'rounded-lg ring-1 ring-primary/50',
                isActive && 'ring-primary',
              )}
            >
              <MessageBubble
                message={m}
                agentName={agentName}
                isStreaming={streaming === true && i === messages.length - 1}
              />
            </div>
          )
        })}
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
