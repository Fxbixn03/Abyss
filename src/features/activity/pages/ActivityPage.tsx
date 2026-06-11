import { useEffect, useMemo, useState } from 'react'
import type { SnapshotMeta } from '@/shared/types/snapshots'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/Icon'
import { LineDiffView } from '@/shared/components/LineDiffView'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const min = Math.round((Date.now() - then) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Human day bucket for grouping: Today / Yesterday / a locale date. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (same(d, today)) return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

interface DiffState {
  previous: string
  current: string | null
  loading: boolean
}

export function ActivityPage() {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Record<string, DiffState>>({})
  const [confirmUndo, setConfirmUndo] = useState<SnapshotMeta | null>(null)

  const refresh = async () => {
    const list = await ipc.listRecentSnapshots(300)
    setSnapshots(list)
    setLoaded(true)
  }

  useEffect(() => {
    let active = true
    void ipc.listRecentSnapshots(300).then((list) => {
      if (!active) return
      setSnapshots(list)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return snapshots
    return snapshots.filter(
      (s) =>
        s.fileName.toLowerCase().includes(q) ||
        s.originalPath.toLowerCase().includes(q),
    )
  }, [snapshots, filter])

  // Group the (already newest-first) list into day buckets, preserving order.
  const groups = useMemo(() => {
    const out: { label: string; items: SnapshotMeta[] }[] = []
    for (const s of filtered) {
      const label = dayLabel(s.timestamp)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(s)
      else out.push({ label, items: [s] })
    }
    return out
  }, [filtered])

  const toggleDiff = async (snap: SnapshotMeta) => {
    if (expanded[snap.id]) {
      setExpanded((e) => {
        const next = { ...e }
        delete next[snap.id]
        return next
      })
      return
    }
    setExpanded((e) => ({
      ...e,
      [snap.id]: { previous: '', current: null, loading: true },
    }))
    try {
      const [content, live] = await Promise.all([
        ipc.readSnapshot(snap.id),
        ipc.snapshotCurrent(snap.id),
      ])
      setExpanded((e) => ({
        ...e,
        [snap.id]: {
          previous: content?.content ?? '',
          current: live.content,
          loading: false,
        },
      }))
    } catch (err) {
      setExpanded((e) => {
        const next = { ...e }
        delete next[snap.id]
        return next
      })
      reportError(err, { title: "Couldn't load the change" })
    }
  }

  const undo = async (snap: SnapshotMeta) => {
    setConfirmUndo(null)
    try {
      const result = await ipc.restoreSnapshot(snap.id)
      if (result?.success) {
        setExpanded((e) => {
          const next = { ...e }
          delete next[snap.id]
          return next
        })
        await refresh()
      }
    } catch (err) {
      reportError(err, { title: "Couldn't undo the change" })
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Activity"
        description="Every file Abyss changed — newest first, with one-click undo"
        icon="scroll-text"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <Icon name="refresh-cw" />
            Refresh
          </Button>
        }
      />

      {snapshots.length > 0 && (
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by file name or path…"
            className="pl-9"
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {loaded && snapshots.length === 0 ? (
          <EmptyState
            icon="scroll-text"
            title="No activity yet"
            description="Abyss logs every config file it overwrites here, so you can review and undo any change it made."
          />
        ) : loaded && filtered.length === 0 ? (
          <EmptyState
            icon="search-x"
            title="No matching changes"
            description="No changed files match your filter."
          />
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="space-y-1.5">
              <h2 className="sticky top-0 bg-background/80 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                {group.label}
              </h2>
              {group.items.map((snap) => {
                const diff = expanded[snap.id]
                const unchanged =
                  diff && !diff.loading && diff.current === diff.previous
                return (
                  <div
                    key={snap.id}
                    className="rounded-lg border border-border bg-card/40"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <Icon
                        name="file-pen-line"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {snap.fileName}
                        </p>
                        <p className="truncate font-code text-[11px] text-muted-foreground">
                          {snap.originalPath}
                        </p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {formatBytes(snap.sizeBytes)}
                      </span>
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {relativeTime(snap.timestamp)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleDiff(snap)}
                        >
                          <Icon
                            name={diff ? 'chevron-up' : 'git-compare'}
                          />
                          Diff
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void ipc.revealPath(snap.originalPath)}
                          title="Reveal in file manager"
                        >
                          <Icon name="folder-open" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmUndo(snap)}
                        >
                          <Icon name="rotate-ccw" />
                          Undo
                        </Button>
                      </div>
                    </div>
                    {diff && (
                      <div className="border-t border-border p-3">
                        {diff.loading ? (
                          <p className="text-xs text-muted-foreground">
                            Loading diff…
                          </p>
                        ) : unchanged ? (
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Icon name="check" className="size-3.5" />
                            This change still matches the file on disk — nothing
                            to undo.
                          </p>
                        ) : (
                          <LineDiffView
                            a={diff.current ?? ''}
                            b={diff.previous}
                            leftLabel="Current (on disk)"
                            rightLabel="Before this change"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          ))
        )}
      </div>

      <ConfirmDialog
        open={confirmUndo != null}
        onOpenChange={(open) => !open && setConfirmUndo(null)}
        title="Undo this change?"
        description={`This restores ${
          confirmUndo?.originalPath ?? 'the file'
        } to its content from before this change. The current content is snapshotted first, so the undo itself can be undone.`}
        confirmLabel="Undo change"
        destructive={false}
        onConfirm={() => confirmUndo && void undo(confirmUndo)}
      />
    </div>
  )
}
