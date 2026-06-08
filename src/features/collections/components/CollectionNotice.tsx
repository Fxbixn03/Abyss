import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import type { CollectionController } from '../hooks/useCollectionManager'

/** Inline success/error banner for collection actions (export, migrate, …). */
export function CollectionNotice({ cm }: { cm: CollectionController }) {
  if (!cm.notice) return null
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm',
        cm.notice.type === 'success'
          ? 'border-primary/40 bg-accent text-foreground'
          : 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      <span className="flex items-center gap-2">
        <Icon
          name={cm.notice.type === 'success' ? 'circle-check' : 'circle-alert'}
          className="size-4 shrink-0"
        />
        <span>{cm.notice.message}</span>
      </span>
      <button
        type="button"
        onClick={() => cm.setNotice(null)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <Icon name="x" className="size-4" />
      </button>
    </div>
  )
}
