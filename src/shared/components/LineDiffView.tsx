import { lineDiff } from '@/shared/lib/lineDiff'
import { cn } from '@/shared/lib/utils'

/**
 * Two-column line diff. `a` is the left/old side (removals highlighted red),
 * `b` is the right/new side (additions highlighted green). Optional column
 * labels render a sticky header — handy for "Current vs Snapshot" framing.
 */
export function LineDiffView({
  a,
  b,
  leftLabel,
  rightLabel,
}: {
  a: string
  b: string
  leftLabel?: string
  rightLabel?: string
}) {
  const rows = lineDiff(a, b)
  return (
    <div className="overflow-auto rounded-md border border-border font-code text-xs">
      {(leftLabel || rightLabel) && (
        <div className="sticky top-0 grid grid-cols-2 border-b border-border bg-card/80 font-medium backdrop-blur">
          <span className="border-r border-border px-2 py-1 text-muted-foreground">
            {leftLabel}
          </span>
          <span className="px-2 py-1 text-muted-foreground">{rightLabel}</span>
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2">
          <div
            className={cn(
              'whitespace-pre-wrap break-words border-r border-border px-2 py-0.5',
              r.type === 'remove' && 'bg-destructive/10',
            )}
          >
            {r.left ?? ''}
          </div>
          <div
            className={cn(
              'whitespace-pre-wrap break-words px-2 py-0.5',
              r.type === 'add' && 'bg-success/10',
            )}
          >
            {r.right ?? ''}
          </div>
        </div>
      ))}
    </div>
  )
}
