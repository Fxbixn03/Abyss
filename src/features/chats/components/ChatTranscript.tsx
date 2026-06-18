import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@/shared/types/chat'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { MessageBubble } from './MessageBubble'
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
            className={cn('h-3 motion-safe:animate-pulse rounded-full bg-muted/60', width)}
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

/** How many trailing messages render initially; older ones load on demand. */
const WINDOW = 40

export function ChatTranscript({
  messages,
  loading,
  agentName,
  streaming,
  searchOpen: searchOpenProp,
  onSearchOpenChange,
  density = 'comfortable',
  scrollToBottom: scrollToBottomRef,
  jumpToIndex,
  pending = false,
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
  /** Message density: 'compact' uses less vertical space, 'comfortable' is the default. */
  density?: 'compact' | 'comfortable'
  /**
   * If provided, the component will call this with a stable `scrollToBottom`
   * function that re-locks the view to the bottom and scrolls immediately.
   * Call it from the parent's onSend handler to ensure the new turn is visible.
   */
  scrollToBottom?: (fn: () => void) => void
  /**
   * When set to a non-null value, the component scrolls `index` into view and
   * briefly applies a highlight ring. The `seq` field ensures repeated clicks
   * on the same message always re-trigger the scroll even if the index is
   * unchanged.
   */
  jumpToIndex?: { index: number; seq: number } | null
  /** Agent is working but hasn't produced visible output yet → show typing dots. */
  pending?: boolean
}) {
  const { t } = useTranslation('chats')
  const endRef = useRef<HTMLDivElement>(null)
  const bottomLocked = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<(HTMLDivElement | null)[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  // Capture the prop in a ref so the registration effect can safely list it in
  // its dep array without re-running whenever the parent re-renders.
  const scrollToBottomRefCallback = useRef(scrollToBottomRef)

  // Track message IDs that were already present when the current session mounted.
  // Only messages NOT in this set receive the bubble-in entrance animation.
  // Initialised lazily so the first render's messages are all treated as historical.
  const [mountedMessageIds, setMountedMessageIds] = useState<Set<string>>(
    () => new Set(messages.map((m) => m.id)),
  )

  // Whether the user has scrolled more than one viewport height from the top.
  const [showJumpTop, setShowJumpTop] = useState(false)
  // Whether the user is NOT at the bottom (bottomLocked === false).
  const [showJumpBottom, setShowJumpBottom] = useState(false)
  // Index of the message currently highlighted via a risk-panel jump (cleared after 1s).
  const [jumpHighlight, setJumpHighlight] = useState<number | null>(null)
  // Count of new messages that arrived while the user was scrolled away from the bottom.
  const [newMessageCount, setNewMessageCount] = useState(0)
  // Tracks the previous messages.length to compute the delta on each render.
  const prevMessageCountRef = useRef(messages.length)

  // Stable imperative handle: re-locks to bottom and scrolls immediately.
  // Registered with the parent via the scrollToBottom prop so ChatsPage can
  // call it from the Composer's onSend handler after the user submits.
  const scrollToBottomFn = useCallback(() => {
    bottomLocked.current = true
    setShowJumpBottom(false)
    setNewMessageCount(0)
    endRef.current?.scrollIntoView({ block: 'end', behavior: scrollBehavior() })
  }, [])

  // Publish the stable handle to the parent on first render (and never again).
  // scrollToBottomRefCallback.current holds the prop captured at mount;
  // scrollToBottomFn is stable (useCallback with []), so deps are accurate.
  useEffect(() => {
    scrollToBottomRefCallback.current?.(scrollToBottomFn)
  }, [scrollToBottomFn])

  // Scroll to the risk-panel jump target and briefly highlight it.
  useEffect(() => {
    if (jumpToIndex == null) return
    const el = messageRefs.current[jumpToIndex.index]
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
      setJumpHighlight(jumpToIndex.index)
      const timer = window.setTimeout(() => setJumpHighlight(null), 1000)
      return () => window.clearTimeout(timer)
    }
  }, [jumpToIndex])

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

  // Pagination window: how many trailing messages to render; older load on demand.
  const [visibleCount, setVisibleCount] = useState(WINDOW)

  // Reset the window when the conversation changes (different first message).
  // Adjusting state during render per the React "derive on prop change" pattern.
  const firstId = messages[0]?.id
  const prevFirstId = useRef(firstId)
  if (prevFirstId.current !== firstId) {
    prevFirstId.current = firstId
    setVisibleCount(WINDOW)
    // Populate the mounted-ids set so all messages present at session-switch
    // are treated as historical (no entrance animation).
    setMountedMessageIds(new Set(messages.map((m) => m.id)))
  }

  // Track whether the user is pinned near the bottom; only autoscroll if so.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    bottomLocked.current = isNearBottom
    setShowJumpBottom(!isNearBottom)
    setShowJumpTop(el.scrollTop > el.clientHeight)
    if (isNearBottom) {
      setNewMessageCount(0)
    }
  }

  useEffect(() => {
    if (bottomLocked.current) {
      endRef.current?.scrollIntoView({ block: 'end', behavior: scrollBehavior() })
    }
  }, [messages, pending])

  // Track new messages that arrive while the user is scrolled up (not bottom-locked).
  useEffect(() => {
    const delta = messages.length - prevMessageCountRef.current
    prevMessageCountRef.current = messages.length
    if (delta > 0 && !bottomLocked.current) {
      setNewMessageCount((c) => c + delta)
    }
    // When the user is back at the bottom, auto-scroll fires above and we reset.
    if (bottomLocked.current) {
      setNewMessageCount(0)
    }
  }, [messages.length])

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
    setNewMessageCount(0)
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

  if (messages.length === 0 && !pending) {
    return (
      <EmptyState
        icon="messages-square"
        title={t('transcript.emptyTitle')}
        description={t('transcript.emptyDesc')}
      />
    )
  }

  const hiddenCount = Math.max(0, messages.length - visibleCount)
  const shown = hiddenCount > 0 ? messages.slice(-visibleCount) : messages

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
            placeholder={t('transcript.searchPlaceholder')}
            className="h-7 flex-1 border-none bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
            aria-label={t('transcript.searchAriaLabel')}
          />
          <span
            className="shrink-0 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {query.trim() === '' ? '' : matchIndices.length === 0
              ? t('transcript.noResults')
              : t('transcript.matchCounter', { current: activeMatch + 1, total: matchIndices.length })}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={goToPrev}
            disabled={matchIndices.length === 0}
            aria-label={t('transcript.prevMatch')}
            title={t('transcript.prevMatch')}
          >
            <Icon name="chevron-up" className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={goToNext}
            disabled={matchIndices.length === 0}
            aria-label={t('transcript.nextMatch')}
            title={t('transcript.nextMatch')}
          >
            <Icon name="chevron-down" className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={closeSearch}
            aria-label={t('transcript.closeSearch')}
            title={t('transcript.closeSearch')}
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
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className={cn(
          'flex h-full flex-col overflow-y-auto px-1',
          density === 'compact' ? 'gap-2 py-0.5' : 'gap-5 py-2',
          searchOpen && 'pt-11',
        )}
      >
        {hiddenCount > 0 && (
          <div className="flex justify-center pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((c) => c + WINDOW)}
            >
              <Icon name="chevron-up" />
              {t('transcript.loadOlder', { count: Math.min(WINDOW, hiddenCount) })}
            </Button>
          </div>
        )}
        {shown.map((m, j) => {
          // Map the windowed index back to the full-array index so search
          // highlighting, message refs and risk-panel jumps stay aligned.
          const i = j + hiddenCount
          const matchPos = matchIndices.indexOf(i)
          const isMatch = matchPos !== -1
          const isActive = isMatch && matchPos === activeMatch
          const isJumpTarget = jumpHighlight != null && jumpHighlight === i
          // Only animate messages that weren't present when the session mounted.
          const isNew = !mountedMessageIds.has(m.id)
          return (
            <div
              key={m.id}
              ref={(el) => {
                messageRefs.current[i] = el
              }}
              className={cn(
                isNew && 'motion-safe:animate-bubble-in',
                isMatch && 'rounded-lg ring-1 ring-primary/50',
                isActive && 'ring-primary',
                isJumpTarget && 'rounded-lg ring-2 ring-primary',
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
        {pending && <TypingIndicator agentName={agentName} />}
        <div ref={endRef} />
      </div>

      {/* Floating jump buttons anchored to the bottom-right of the scroll container */}
      {(showJumpTop || showJumpBottom) && (
        <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col gap-1">
          {showJumpTop && (
            <Button
              size="icon"
              variant="outline"
              aria-label={t('transcript.jumpToTop')}
              title={t('transcript.jumpToTop')}
              className="pointer-events-auto shadow-md"
              onClick={jumpToTop}
            >
              <Icon name="arrow-up" className="size-4" />
            </Button>
          )}
          {showJumpBottom && (
            <div className="relative">
              <Button
                size="icon"
                variant="outline"
                aria-label={
                  newMessageCount > 0
                    ? t('transcript.jumpToBottomNew', { count: Math.min(newMessageCount, 99) })
                    : t('transcript.jumpToBottom')
                }
                title={t('transcript.jumpToBottom')}
                className="pointer-events-auto shadow-md"
                onClick={jumpToBottom}
              >
                <Icon name="arrow-down" className="size-4" />
              </Button>
              {newMessageCount > 0 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-medium leading-none text-primary-foreground"
                >
                  {newMessageCount > 99 ? '99+' : newMessageCount}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Animated three-dot "agent is working" indicator. */
function TypingIndicator({ agentName }: { agentName?: string }) {
  const { t } = useTranslation('chats')
  return (
    <div
      className="flex items-center gap-1.5 text-muted-foreground"
      aria-label={t('transcript.typingIndicator', { agent: agentName ?? 'Agent' })}
    >
      <span className="size-1.5 motion-safe:animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="size-1.5 motion-safe:animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="size-1.5 motion-safe:animate-bounce rounded-full bg-current" />
    </div>
  )
}
