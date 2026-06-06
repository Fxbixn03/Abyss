import { useEffect, useMemo, useState } from 'react'
import type { SnapshotMeta } from '@/shared/types/snapshots'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { lineDiff, diffStats } from '../lib/diff'

const PREFIX = { add: '+', remove: '-', context: ' ' } as const

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export interface FileHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  /** The current on-disk content, used as the right-hand side of the diff. */
  current: string
  /** Called after a successful restore so the editor can reload. */
  onRestored?: () => void
}

/** Snapshot history for a single file: pick a version, diff it, restore it. */
export function FileHistoryDialog({
  open,
  onOpenChange,
  filePath,
  current,
  onRestored,
}: FileHistoryDialogProps) {
  const [snaps, setSnaps] = useState<SnapshotMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snapContent, setSnapContent] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (!open || !filePath) return
    let active = true
    void ipc.listSnapshots(filePath).then((list) => {
      if (!active) return
      setSnaps(list)
      setSelectedId(list[0]?.id ?? null)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [open, filePath])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    void ipc.readSnapshot(selectedId).then((r) => {
      if (active) setSnapContent(r?.content ?? '')
    })
    return () => {
      active = false
    }
  }, [selectedId])

  const lines = useMemo(
    () => lineDiff(snapContent, current),
    [snapContent, current],
  )
  const stats = useMemo(() => diffStats(lines), [lines])

  const restore = async () => {
    if (!selectedId) return
    setRestoring(true)
    await ipc.restoreSnapshot(selectedId)
    setRestoring(false)
    onOpenChange(false)
    onRestored?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>File history</DialogTitle>
          <DialogDescription className="font-code text-xs">
            {filePath}
          </DialogDescription>
        </DialogHeader>

        {loaded && snaps.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No history yet. A snapshot is captured automatically every time you
            save this file.
          </p>
        ) : (
          <div className="grid grid-cols-[190px_1fr] gap-3">
            <aside className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto pr-1">
              {snaps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'rounded-md border px-2.5 py-1.5 text-left transition-colors',
                    s.id === selectedId
                      ? 'border-primary/50 bg-accent'
                      : 'border-transparent hover:bg-accent/60',
                  )}
                >
                  <div className="text-xs font-medium">
                    {relativeTime(s.timestamp)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(s.timestamp).toLocaleString()}
                  </div>
                </button>
              ))}
            </aside>

            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  selected version → current
                </span>
                <Badge variant="success">+{stats.added}</Badge>
                <Badge variant="danger">-{stats.removed}</Badge>
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => void restore()}
                  disabled={!selectedId || restoring}
                >
                  <Icon name="rotate-ccw" />
                  {restoring ? 'Restoring…' : 'Restore this version'}
                </Button>
              </div>

              <div
                data-selectable
                className="max-h-[50vh] overflow-auto rounded-md border border-border bg-card font-code text-xs leading-relaxed"
              >
                <pre className="min-w-full">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className={cn(
                        'px-3 py-px',
                        line.type === 'add' && 'bg-success/15 text-success',
                        line.type === 'remove' &&
                          'bg-destructive/15 text-destructive',
                        line.type === 'context' && 'text-muted-foreground',
                      )}
                    >
                      <span className="select-none opacity-60">
                        {PREFIX[line.type]}{' '}
                      </span>
                      {line.text || ' '}
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
