import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { diffStats, lineDiff } from '../lib/diff'

export interface DiffPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  before: string
  after: string
  saving?: boolean
  onConfirm: () => void
}

const PREFIX = { add: '+', remove: '-', context: ' ' } as const

export function DiffPreviewDialog({
  open,
  onOpenChange,
  filePath,
  before,
  after,
  saving = false,
  onConfirm,
}: DiffPreviewDialogProps) {
  const lines = useMemo(() => lineDiff(before, after), [before, after])
  const stats = useMemo(() => diffStats(lines), [lines])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review changes before saving</DialogTitle>
          <DialogDescription className="font-code text-xs">
            {filePath}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Badge variant="success">+{stats.added}</Badge>
          <Badge variant="danger">-{stats.removed}</Badge>
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
                  line.type === 'remove' && 'bg-destructive/15 text-destructive',
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
