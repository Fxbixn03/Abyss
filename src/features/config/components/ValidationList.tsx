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

export function ValidationList({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-success">
        <Icon name="circle-check" className="size-3.5" />
        <span>No issues</span>
      </div>
    )
  }

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
                <span className="font-code text-muted-foreground">
                  L{issue.line}:{' '}
                </span>
              )}
              {issue.message}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
