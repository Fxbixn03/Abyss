import { useEffect, useMemo, useState } from 'react'
import type { SnapshotContent, SnapshotMeta } from '@/shared/types/snapshots'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Icon } from '@/shared/components/Icon'
import { LineDiffView } from '@/shared/components/LineDiffView'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'

type ViewMode = 'file' | 'timeline'
type DetailView = 'content' | 'diff'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const min = Math.round((Date.now() - then) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleString()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Small two-option segmented control. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; icon: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors',
            value === opt.value
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon name={opt.icon} className="size-3.5" />
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('file')
  const [selected, setSelected] = useState<SnapshotContent | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<DetailView>('content')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = async () => {
    const list = await ipc.listRecentSnapshots(200)
    setSnapshots(list)
    setLoaded(true)
  }

  useEffect(() => {
    let active = true
    void ipc.listRecentSnapshots(200).then((list) => {
      if (!active) return
      setSnapshots(list)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  const groups = useMemo(() => {
    const byFile = new Map<string, SnapshotMeta[]>()
    for (const s of snapshots) {
      const list = byFile.get(s.originalPath) ?? []
      list.push(s)
      byFile.set(s.originalPath, list)
    }
    return [...byFile.entries()]
  }, [snapshots])

  const open = async (id: string) => {
    setSelectedId(id)
    setSelected(null)
    setCurrent(null)
    const [content, live] = await Promise.all([
      ipc.readSnapshot(id),
      ipc.snapshotCurrent(id),
    ])
    setSelected(content)
    setCurrent(live.content)
  }

  const restore = async () => {
    if (!selectedId) return
    const result = await ipc.restoreSnapshot(selectedId)
    setConfirmRestore(false)
    if (result?.success) {
      setNotice(`Restored ${result.path}`)
      void refresh()
    }
  }

  /** A snapshot is identical to what's on disk now → nothing to restore. */
  const unchanged = selected != null && current === selected.content

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="History"
        description="Automatic snapshots taken before every config save"
        icon="history"
        actions={
          <div className="flex items-center gap-2">
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'file', label: 'By file', icon: 'file-text' },
                { value: 'timeline', label: 'Timeline', icon: 'clock' },
              ]}
            />
            <Button variant="outline" onClick={() => void refresh()}>
              <Icon name="refresh-cw" />
              Refresh
            </Button>
          </div>
        }
      />

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-accent px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="circle-check" className="size-4 shrink-0" />
            <span className="truncate font-code text-xs">{notice}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      {loaded && snapshots.length === 0 ? (
        <EmptyState
          icon="history"
          title="No snapshots yet"
          description="Abyss saves a snapshot automatically each time it overwrites a config file. They will appear here."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] gap-4">
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            {!loaded ? (
              <p className="px-1 text-sm text-muted-foreground">Loading…</p>
            ) : viewMode === 'file' ? (
              groups.map(([path, items]) => (
                <div key={path} className="flex flex-col gap-1">
                  <p className="flex items-center gap-1.5 px-1 text-xs font-medium">
                    <Icon
                      name="file-text"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{items[0].fileName}</span>
                    <Badge variant="muted" className="ml-auto">
                      {items.length}
                    </Badge>
                  </p>
                  <p className="truncate px-1 font-code text-[10px] text-muted-foreground/60">
                    {path}
                  </p>
                  {items.map((s) => (
                    <SnapshotButton
                      key={s.id}
                      snap={s}
                      active={s.id === selectedId}
                      onClick={() => void open(s.id)}
                    />
                  ))}
                </div>
              ))
            ) : (
              <div className="flex flex-col gap-1">
                {snapshots.map((s) => (
                  <SnapshotButton
                    key={s.id}
                    snap={s}
                    active={s.id === selectedId}
                    showFile
                    onClick={() => void open(s.id)}
                  />
                ))}
              </div>
            )}
          </aside>

          <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card/40">
            {!selected ? (
              <EmptyState
                icon="history"
                title="No snapshot selected"
                description="Pick a snapshot to preview its contents, diff it against the live file, and restore it."
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {selected.meta.fileName}
                    </p>
                    <p className="truncate font-code text-xs text-muted-foreground">
                      {relativeTime(selected.meta.timestamp)} ·{' '}
                      {formatBytes(selected.meta.sizeBytes)} ·{' '}
                      {unchanged ? 'matches the live file' : 'differs from live'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Segmented
                      value={detailView}
                      onChange={setDetailView}
                      options={[
                        {
                          value: 'content',
                          label: 'Content',
                          icon: 'file-text',
                        },
                        { value: 'diff', label: 'Diff', icon: 'git-compare' },
                      ]}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void ipc.revealPath(selected.meta.originalPath)
                      }
                    >
                      <Icon name="folder-open" />
                      Reveal
                    </Button>
                    <Button
                      size="sm"
                      disabled={unchanged}
                      onClick={() => setConfirmRestore(true)}
                    >
                      <Icon name="rotate-ccw" />
                      Restore
                    </Button>
                  </div>
                </div>
                {detailView === 'diff' ? (
                  <div className="min-h-0 flex-1 overflow-auto p-3">
                    <LineDiffView
                      a={current ?? ''}
                      b={selected.content}
                      leftLabel="Current (on disk)"
                      rightLabel="This snapshot"
                    />
                  </div>
                ) : (
                  <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-code text-xs leading-relaxed">
                    {selected.content || '(empty file)'}
                  </pre>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restore this snapshot?"
        description={`This overwrites ${selected?.meta.originalPath ?? 'the file'} with the snapshot's content. The current content is snapshotted first, so this can be undone.`}
        confirmLabel="Restore"
        destructive={false}
        onConfirm={() => void restore()}
      />
    </div>
  )
}

function SnapshotButton({
  snap,
  active,
  showFile,
  onClick,
}: {
  snap: SnapshotMeta
  active: boolean
  showFile?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors',
        active
          ? 'border-primary/50 bg-accent'
          : 'border-transparent hover:bg-accent/60',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon
          name={showFile ? 'file-text' : 'clock'}
          className="size-3 shrink-0 text-muted-foreground"
        />
        <span className="flex min-w-0 flex-col">
          {showFile && <span className="truncate">{snap.fileName}</span>}
          <span className={cn(showFile && 'text-muted-foreground')}>
            {relativeTime(snap.timestamp)}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-muted-foreground">
        {formatBytes(snap.sizeBytes)}
      </span>
    </button>
  )
}
