import type { UIEvent } from 'react'
import { useMemo, useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
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

export function SessionList({ onNewChat }: { onNewChat: () => void }) {
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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

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
    const byProject = new Map<string, typeof filtered>()
    for (const s of filtered) {
      const list = byProject.get(s.projectLabel) ?? []
      list.push(s)
      byProject.set(s.projectLabel, list)
    }
    return [...byProject.entries()]
  }, [sessions, query])

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Button onClick={onNewChat} className="w-full">
        <Icon name="plus" />
        New chat
      </Button>

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
        onScroll={onScroll}
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
                return (
                  <ContextMenu key={s.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() => void openSession(s.id)}
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
                <Icon name="loader" className="size-3 animate-spin" />
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
