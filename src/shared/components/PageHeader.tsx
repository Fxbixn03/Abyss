import type { ReactNode } from 'react'
import { Icon } from './Icon'

export interface PageHeaderProps {
  title: string
  description?: string
  icon?: string
  /** Fully-rendered icon tile; takes precedence over `icon` (e.g. image icons). */
  iconNode?: ReactNode
  actions?: ReactNode
}

export function PageHeader({
  title,
  description,
  icon,
  iconNode,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {iconNode
          ? iconNode
          : icon && (
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon name={icon} className="size-5" />
              </div>
            )}
        <div>
          <h1 className="text-lg font-semibold leading-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
