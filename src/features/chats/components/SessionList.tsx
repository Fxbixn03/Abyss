import type { UIEvent, KeyboardEvent } from 'react'
import { useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
import { scrollBehavior } from '@/shared/lib/motion'
import { ipc } from '@/shared/ipc/ipc.client'
import { estimateCostUsd, formatMoney } from '@/shared/lib/cost'
import { useChatsStore } from '../store/chats.store'
import { usePinnedSessionsStore } from '../store/pinnedSessions.store'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { relativeTime } from '../lib/format'
import {
  sortSessions,
  groupSessions,
  DATE_BUCKET_KEY_ORDER,
} from '../lib/session-list'
import type { SortOrder, GroupBy, DateBucketKey } from '../lib/session-list'
import type { ChatSessionMeta } from '@/shared/types/chat'

interface RenameState {
  sessionId: string
  draft: string
}

const SORT_ORDERS: SortOrder[] = ['recent', 'longest', 'costliest']
const GROUP_BYS: GroupBy[] = ['project', 'date']

export function SessionList({
  onNewChat,
  showNewChat = true,
}: {
  onNewChat: () => void
  showNewChat?: boolean
}) {
  const { t } = useTranslation('chats')
  const sessions = useChatsStore((s) => s.sessions)
  const loading = useChatsStore((s) => s.sessionsLoading)
  const loadingMore = useChatsStore((s) => s.sessionsLoadingMore)
  const total = useChatsStore((s) => s.sessionsTotal)
  const activeSessionId = useChatsStore((s) => s.activeSessionId)
  const openSession = useChatsStore((s) => s.openSession)
  const deleteSession = useChatsStore((s) => s.deleteSession)
  const renameSession = useChatsStore((s) => s.renameSession)
  const exportSession = useChatsStore((s) => s.exportSession)
  const loadMoreSessions = useChatsStore((s) => s.loadMoreSessions)
  const currency = useSettingsStore((s) => s.settings.currency)
  const pinnedSessionIds = usePinnedSessionsStore((s) => s.pinnedSessionIds)
  const togglePin = usePinnedSessionsStore((s) => s.togglePin)

  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<RenameState | null>(null)
  // Raw cursor index — clamped to valid range during render
  const [cursorIndex, setCursorIndex] = useState<number>(-1)

  const renameInputRef = useRef<HTMLInputElement>(null)

  const startRename = useCallback((session: ChatSessionMeta) => {
    setRenaming({ sessionId: session.id, draft: session.title })
    // Focus the input on the next frame so the DOM has updated
    requestAnimationFrame(() => {
      renameInputRef.current?.select()
    })
  }, [])

  const commitRename = useCallback(() => {
    if (!renaming) return
    const trimmed = renaming.draft.trim()
    if (trimmed && trimmed !== sessions.find((s) => s.id === renaming.sessionId)?.title) {
      void renameSession(renaming.sessionId, trimmed)
    }
    setRenaming(null)
  }, [renaming, renameSession, sessions])

  const cancelRename = useCallback(() => {
    setRenaming(null)
  }, [])

  const onRenameKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitRename()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelRename()
      }
    },
    [commitRename, cancelRename],
  )

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
    return groupSessions(sorted, groupBy, pinnedSessionIds)
  }, [sessions, query, sortOrder, groupBy, pinnedSessionIds])

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
          el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
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

  // Resolve a group label: for date-grouped views the label is a DateBucketKey;
  // for project-grouped views it's the raw project name. We detect which by
  // checking whether the label is one of the known date bucket keys.
  const dateBucketLabels: Record<DateBucketKey, string> = useMemo(
    () => ({
      today: t('sessionList.dateBuckets.today'),
      yesterday: t('sessionList.dateBuckets.yesterday'),
      thisWeek: t('sessionList.dateBuckets.thisWeek'),
      thisMonth: t('sessionList.dateBuckets.thisMonth'),
      older: t('sessionList.dateBuckets.older'),
    }),
    [t],
  )

  const resolveGroupLabel = useCallback(
    (label: string): string => {
      if (DATE_BUCKET_KEY_ORDER.includes(label as DateBucketKey)) {
        return dateBucketLabels[label as DateBucketKey]
      }
      return label
    },
    [dateBucketLabels],
  )

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {showNewChat && (
        <Button onClick={onNewChat} className="w-full">
          <Icon name="plus" />
          {t('sessionList.newChat')}
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
          placeholder={t('sessionList.searchPlaceholder')}
          className="pl-8"
        />
      </div>

      <div
        className="flex gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
        role="group"
        aria-label={t('sessionList.sortGroup')}
      >
        {SORT_ORDERS.map((value) => {
          const active = !query.trim() && sortOrder === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSortOrder(value)}
              disabled={!!query.trim()}
              className={cn(
                'flex-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
              )}
              aria-pressed={active}
            >
              {t(`sessionList.sort.${value}`)}
            </button>
          )
        })}
      </div>

      <div
        className="flex gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
        role="group"
        aria-label={t('sessionList.groupGroup')}
      >
        {GROUP_BYS.map((value) => {
          const active = !query.trim() && groupBy === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setGroupBy(value)}
              disabled={!!query.trim()}
              className={cn(
                'flex-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
              )}
              aria-pressed={active}
            >
              {t(`sessionList.group.${value}`)}
            </button>
          )
        })}
      </div>

      <div
        ref={scrollRef}
        role="listbox"
        aria-label={t('title')}
        aria-multiselectable="false"
        aria-activedescendant={
          effectiveCursor >= 0 && flatSessions[effectiveCursor]
            ? `session-opt-${flatSessions[effectiveCursor]!.id}`
            : undefined
        }
        tabIndex={-1}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
      >
        {loading ? (
          <p className="px-1 pt-2 text-sm text-muted-foreground">{t('sessionList.loading')}</p>
        ) : groups.length === 0 ? (
          <p className="px-1 pt-2 text-sm text-muted-foreground">
            {sessions.length === 0 ? t('sessionList.noChatsYet') : t('sessionList.noMatches')}
          </p>
        ) : (
          groups.map(([groupLabel, items]) => (
            <div key={groupLabel} className="flex flex-col gap-1">
              <p className="truncate px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {resolveGroupLabel(groupLabel)}
              </p>
              {items.map((s) => {
                const active = s.id === activeSessionId
                const flatIdx = flatSessions.indexOf(s)
                const isCursor = flatIdx === effectiveCursor
                // First session gets tabIndex=0 when no cursor is active so Tab focuses it
                const isFirstWithNoCursor =
                  effectiveCursor < 0 && flatIdx === 0
                const pinned = pinnedSessionIds.has(s.id)
                const sessionAriaLabel = pinned
                  ? t('sessionList.sessionAriaLabelPinned', {
                      title: s.title,
                      project: s.projectLabel,
                      time: relativeTime(s.updatedAt, t),
                      count: s.messageCount,
                    })
                  : t('sessionList.sessionAriaLabel', {
                      title: s.title,
                      project: s.projectLabel,
                      time: relativeTime(s.updatedAt, t),
                      count: s.messageCount,
                    })
                return (
                  <ContextMenu key={s.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        id={`session-opt-${s.id}`}
                        data-session-id={s.id}
                        type="button"
                        role="option"
                        onClick={() => {
                          if (renaming?.sessionId === s.id) return
                          setCursorIndex(flatIdx)
                          void openSession(s.id)
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          startRename(s)
                        }}
                        onFocus={() => {
                          setCursorIndex(flatIdx)
                        }}
                        tabIndex={isCursor || isFirstWithNoCursor ? 0 : -1}
                        aria-selected={active}
                        aria-label={sessionAriaLabel}
                        className={cn(
                          'flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                          active
                            ? 'border-primary/50 bg-accent'
                            : 'border-transparent hover:bg-accent/60',
                        )}
                      >
                        {renaming?.sessionId === s.id ? (
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renaming.draft}
                            onChange={(e) =>
                              setRenaming({ ...renaming, draft: e.target.value })
                            }
                            onKeyDown={onRenameKeyDown}
                            onBlur={commitRename}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded bg-transparent text-sm font-medium outline-none ring-1 ring-primary/60 focus:ring-primary"
                            aria-label={t('sessionList.renameAriaLabel')}
                          />
                        ) : (
                          <span className="flex items-center gap-1 truncate">
                            {pinned && (
                              <Icon
                                name="pin"
                                className="size-3 shrink-0 text-primary"
                                aria-hidden="true"
                              />
                            )}
                            <span className="truncate text-sm font-medium">
                              {s.title}
                            </span>
                          </span>
                        )}
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{relativeTime(s.updatedAt, t)}</span>
                          <span>· {s.messageCount} msg</span>
                          {s.gitBranch && (
                            <span className="flex items-center gap-0.5 truncate">
                              <Icon name="git-branch" className="size-3" />
                              {s.gitBranch}
                            </span>
                          )}
                          {(() => {
                            const cost = estimateCostUsd(
                              s.inputTokens ?? 0,
                              s.outputTokens ?? 0,
                            )
                            return cost >= 0.001 ? (
                              <span className="font-code text-[11px] text-muted-foreground">
                                {formatMoney(cost, currency)}
                              </span>
                            ) : null
                          })()}
                        </span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onSelect={() => togglePin(s.id)}>
                        <Icon name="pin" />
                        {pinned ? t('sessionList.contextMenu.unpin') : t('sessionList.contextMenu.pin')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => startRename(s)}>
                        <Icon name="pencil" />
                        {t('sessionList.contextMenu.rename')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => void exportSession(s.id, 'markdown')}
                      >
                        <Icon name="download" />
                        {t('sessionList.contextMenu.exportMarkdown')}
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => void exportSession(s.id, 'json')}
                      >
                        <Icon name="braces" />
                        {t('sessionList.contextMenu.exportJson')}
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => void ipc.revealPath(s.filePath)}
                      >
                        <Icon name="folder-open" />
                        {t('sessionList.contextMenu.revealFile')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setPendingDelete(s.id)}
                      >
                        <Icon name="trash" />
                        {t('sessionList.contextMenu.delete')}
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
                <Spinner className="size-3" label={t('sessionList.loadingMore')} />
                {t('sessionList.loadingMore')}
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => void loadMoreSessions()}
              >
                {t('sessionList.loadMore', {
                  count: Math.min(20, total - sessions.length),
                  remaining: total - sessions.length,
                })}
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
        title={t('sessionList.deleteDialog.title')}
        description={t('sessionList.deleteDialog.description')}
        confirmLabel={t('sessionList.deleteDialog.confirm')}
        onConfirm={() => {
          const id = pendingDelete
          setPendingDelete(null)
          if (id) void deleteSession(id)
        }}
      />
    </div>
  )
}
