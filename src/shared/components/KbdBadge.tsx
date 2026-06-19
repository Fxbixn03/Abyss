import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface KbdBadgeProps {
  children: ReactNode
  className?: string
}

export function KbdBadge({ children, className }: KbdBadgeProps) {
  return (
    <kbd
      className={cn(
        'rounded border border-border bg-muted px-1 py-0.5 font-code text-[10px] text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
