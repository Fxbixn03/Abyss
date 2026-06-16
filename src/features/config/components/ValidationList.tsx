import { useCallback, useEffect, useRef, useState } from 'react'
import type { ValidationIssue, ValidationSeverity } from '@/shared/types/agent'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'

const SEVERITY: Record<
  ValidationSeverity,
  { icon: string; className: string }
> = {
  error: { icon: 'circle-alert', className: 'text-destructive' },
  warning: { icon: 'alert-triangle', className: 'text-warning' },
  info: { icon: 'info', className: 'text-muted-foreground' },
}

interface ValidationListProps {
  issues: ValidationIssue[]
  onJumpToLine?: (line: number) => void
}

/** Full list of issues — rendered inside the popover panel. */
function IssueList({
  issues,
  onJumpToLine,
}: {
  issues: ValidationIssue[]
  onJumpToLine?: (line: number) => void
}) {
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue, index) => {
        const meta = SEVERITY[issue.severity]
        return (
          <li
            key={index}
            className="flex items-start gap-2 px-1 text-xs text-muted-foreground"
          >
            <Icon
              name={meta.icon}
              className={cn('mt-0.5 size-3.5 shrink-0', meta.className)}
            />
            <span>
              {issue.line !== undefined && (
                <>
                  {onJumpToLine ? (
                    <button
                      type="button"
                      onClick={() => onJumpToLine(issue.line!)}
                      className="font-code text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      title={`Jump to line ${issue.line}`}
                    >
                      L{issue.line}
                    </button>
                  ) : (
                    <span className="font-code text-muted-foreground">
                      L{issue.line}
                    </span>
                  )}
                  {': '}
                </>
              )}
              {issue.message}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function ValidationList({ issues, onJumpToLine }: ValidationListProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  const handleJumpToLine = useCallback(
    (line: number) => {
      setOpen(false)
      onJumpToLine?.(line)
    },
    [onJumpToLine],
  )

  // Close popover on click outside.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close popover on Escape key.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-success">
        <Icon name="circle-check" className="size-3.5" />
        <span>No issues</span>
      </div>
    )
  }

  // Build summary parts, e.g. "2 errors · 1 warning"
  const summaryParts: string[] = []
  if (errorCount > 0)
    summaryParts.push(`${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`)
  if (warningCount > 0)
    summaryParts.push(
      `${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`,
    )
  if (infoCount > 0)
    summaryParts.push(`${infoCount} ${infoCount === 1 ? 'info' : 'info'}`)

  const summaryLabel = summaryParts.join(' · ')

  // Determine chip colour: red when errors present, yellow for warnings only.
  const chipClass =
    errorCount > 0
      ? 'text-destructive hover:bg-destructive/10'
      : 'text-warning hover:bg-warning/10'

  const chipIcon = errorCount > 0 ? 'circle-alert' : 'alert-triangle'

  return (
    <div ref={containerRef} className="relative">
      {/* Compact summary chip */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          chipClass,
        )}
      >
        <Icon name={chipIcon} className="size-3.5 shrink-0" />
        <span>{summaryLabel}</span>
        <Icon
          name={open ? 'chevron-down' : 'chevron-up'}
          className="size-3 shrink-0 opacity-70"
        />
      </button>

      {/* Floating popover panel anchored above the chip */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Validation issues"
          className="absolute bottom-full left-0 z-50 mb-2 min-w-72 max-w-sm rounded-md border border-border bg-popover p-3 shadow-md"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Icon name="list-checks" className="size-3" />
            <span>Issues</span>
          </div>
          <IssueList issues={issues} onJumpToLine={handleJumpToLine} />
        </div>
      )}
    </div>
  )
}
