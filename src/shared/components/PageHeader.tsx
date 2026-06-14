import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isBetaRoute } from '@/app/navigation'
import { Badge } from '@/shared/components/ui/badge'
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
  const location = useLocation()
  const isBeta = isBetaRoute(location.pathname)

  return (
    <div
      data-tour="page-header"
      className="flex items-start justify-between gap-4"
    >
      <div className="flex items-start gap-3">
        {iconNode
          ? iconNode
          : icon && (
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon name={icon} className="size-5" />
              </div>
            )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            {isBeta && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wide"
              >
                Beta
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
