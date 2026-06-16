import type { UIEvent, KeyboardEvent } from 'react'
import { useMemo, useState, useRef, useCallback } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { Spinner } from '@/shared/components/Spinner'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useChatsStore } from '../store/chats.store'
import { relativeTime } from '../lib/format'
import type { ChatSessionMeta } from '@/shared/types/chat'

type SortOrder = 'recent' | 'longest' | 'costliest'

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'longest', label: 'Longest' },
  { value: 'costliest', label: 'Costliest' },
]

function sortSessions(
  sessions: ChatSessionMeta[],
  sort: SortOrder,
): ChatSessionMeta[] {
  if (sort === 'recent') return sessions
  const copy = [...sessions]
  if (sort === 'longest') {
    copy.sort((a, b) => b.messageCount - a.messageCount)
  } else {
    // costliest: descending outputTokens, falling back to inputTokens
    copy.sort((a, b) => {
      const costA = (a.outputTokens ?? 0) || (a.inputTokens ?? 0)
      const costB = (b.outputTokens ?? 0) || (b.inputTokens ?? 0)
      return costB - costA
    })
  }
  return copy
}

export function SessionList({
  onNewChat,
  showNewChat = true,
}: {
  onNewChat: () => void
  showNewChat?: boolean
}) {
  const sessions = useChatsStore((s) => s.sessions)
  const loading = useChatsStore((s) => s.sessionsLoading)
  const loadingMore = useChatsStore((s) => s.sessionsLoadingMore)
  const total = useChatsStore((s) => s.sessionsTotal)
  const activeSessionId = useChatsStore((s) => s.activeSessionId)
  const openSession = useChatsStore((s) => s.openSession)
  const deleteSession = useChatsStore((s) => s.deleteSession)
  const exportSession = useChatsStore((s) => s.exportSession)
  const loadMoreSessions = useChatsStore((s) => s.loadMoreSessions)

  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // Raw cursor index — clamped to valid range during render
  const [cursorIndex, setCursorIndex] = useState<number>(-1)

  // Ref to the scroll container for querying session buttons by data-session-id
  const scrollRef = useRef<HTMLDivElement>(null)

  // Infinite scroll: pull the next page as the list nears the bottom. Disabled
  // while a search is active (search filters only what's already loaded).
  const hasMore = sessions.length < total
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!hasMore || loadingMore || query.trim()) return
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      void loadMoreSessions()
    }
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.projectLabel.toLowerCase().includes(q) ||
            s.cwd.toLowerCase().includes(q),
        )
      : sessions
    // When a search is active, skip sorting (filtering order is fine); otherwise
    // apply the user-selected sort before grouping so groups and items both reflect it.
    const sorted = q ? filtered : sortSessions(filtered, sortOrder)
    const byProject = new Map<string, typeof sorted>()
    for (const s of sorted) {
      const list = byProject.get(s.projectLabel) ?? []
      list.push(s)
      byProject.set(s.projectLabel, list)
    }
    return [...byProject.entries()]
  }, [sessions, query, sortOrder])

  // Flatten all visible sessions in order (skipping group headers) for keyboard nav
  const flatSessions = useMemo(
    () => groups.flatMap(([, items]) => items),
    [groups],
  )

  // Derive effective cursor: clamp when list shrinks without triggering setState in effect
  const effectiveCursor =
    flatSessions.length === 0
      ? -1
      : cursorIndex >= flatSessions.length
        ? flatSessions.length - 1
        : cursorIndex

  const getButtonEl = useCallback((sessionId: string): HTMLButtonElement | null => {
    return scrollRef.current?.querySelector<HTMLButtonElement>(
      `[data-session-id="${CSS.escape(sessionId)}"]`,
    ) ?? null
  }, [])

  const moveCursor = useCallback(
    (nextIndex: number) => {
      if (flatSessions.length === 0) return
      const clamped = Math.max(0, Math.min(nextIndex, flatSessions.length - 1))
      setCursorIndex(clamped)
      const session = flatSessions[clamped]
      if (session) {
        const el = getButtonEl(session.id)
        if (el) {
          el.scrollIntoView({ block: 'nearest' })
          el.focus()
        }
      }
    },
    [flatSessions, getButtonEl],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (flatSessions.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveCursor(effectiveCursor < 0 ? 0 : effectiveCursor + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveCursor(effectiveCursor <= 0 ? 0 : effectiveCursor - 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (effectiveCursor >= 0 && effectiveCursor < flatSessions.length) {
          e.preventDefault()
          const session = flatSessions[effectiveCursor]
          if (session) void openSession(session.id)
        }
      }
    },
    [effectiveCursor, flatSessions, moveCursor, openSession],
  )

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {showNewChat && (
        <Button onClick={onNewChat} className="w-full">
          <Icon name="plus" />
          New chat
        </Button>
      )}

      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          className="pl-8"
        />
      </div>

      <div
        className="flex gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
        role="group"
        aria-label="Sort sessions"
      >
        {SORT_OPTIONS.map((opt) => {
          const active = !query.trim() && sortOrder === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSortOrder(opt.value)}
              disabled={!!query.trim()}
              className={cn(
                'flex-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
              )}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- session buttons inside are the interactive elements with their own keyboard roles; this div is a scroll container */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
      >
        {loading ? (
          <p className="px-1 pt-2 text-sm text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="px-1 pt-2 text-sm text-muted-foreground">
            {sessions.length === 0 ? 'No chats yet.' : 'No matches.'}
          </p>
        ) : (
          groups.map(([project, items]) => (
            <div key={project} className="flex flex-col gap-1">
              <p className="truncate px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {project}
              </p>
              {items.map((s) => {
                const active = s.id === activeSessionId
                const flatIdx = flatSessions.indexOf(s)
                const isCursor = flatIdx === effectiveCursor
                // First session gets tabIndex=0 when no cursor is active so Tab focuses it
                const isFirstWithNoCursor =
                  effectiveCursor < 0 && flatIdx === 0
                return (
                  <ContextMenu key={s.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        data-session-id={s.id}
                        type="button"
                        role="option"
                        onClick={() => {
                          setCursorIndex(flatIdx)
                          void openSession(s.id)
                        }}
                        onFocus={() => {
                          setCursorIndex(flatIdx)
                        }}
                        tabIndex={isCursor || isFirstWithNoCursor ? 0 : -1}
                        aria-selected={active}
                        aria-label={`${s.title} — ${s.projectLabel}, ${relativeTime(s.updatedAt)}, ${s.messageCount} messages`}
                        className={cn(
                          'flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                          active
                            ? 'border-primary/50 bg-accent'
                            : 'border-transparent hover:bg-accent/60',
                        )}
                      >
                        <span className="truncate text-sm font-medium">
                          {s.title}
                        </span>
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{relativeTime(s.updatedAt)}</span>
                          <span>· {s.messageCount} msg</span>
                          {s.gitBranch && (
                            <span className="flex items-center gap-0.5 truncate">
                              <Icon name="git-branch" className="size-3" />
                              {s.gitBranch}
                            </span>
                          )}
                        </span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onSelect={() => void exportSession(s.id, 'markdown')}
                      >
                        <Icon name="download" />
                        Export as Markdown
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => void exportSession(s.id, 'json')}
                      >
                        <Icon name="braces" />
                        Export as JSON
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => void ipc.revealPath(s.filePath)}
                      >
                        <Icon name="folder-open" />
                        Reveal file
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setPendingDelete(s.id)}
                      >
                        <Icon name="trash" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
            </div>
          ))
        )}

        {!loading && hasMore && !query.trim() && (
          <div className="px-1 pb-2">
            {loadingMore ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner className="size-3" label="Loading more…" />
                Loading more…
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => void loadMoreSessions()}
              >
                Load {Math.min(20, total - sessions.length)} more ·{' '}
                {total - sessions.length} left
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete this chat?"
        description="This permanently removes the transcript file from disk."
        confirmLabel="Delete"
        onConfirm={() => {
          const id = pendingDelete
          setPendingDelete(null)
          if (id) void deleteSession(id)
        }}
      />
    </div>
  )
}
