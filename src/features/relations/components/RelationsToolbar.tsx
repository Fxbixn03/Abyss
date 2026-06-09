import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { KIND_ICON, KIND_LABEL } from '../lib/nodeMeta'
import { ALL_NODE_KINDS, type RelationsController } from '../hooks/useRelations'

/** Filter chips (node kinds) + edge toggles + layout/refresh controls. */
export function RelationsToolbar({ ctrl }: { ctrl: RelationsController }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {ALL_NODE_KINDS.map((kind) => {
          const active = !ctrl.hiddenKinds.has(kind)
          return (
            <button
              key={kind}
              type="button"
              onClick={() => ctrl.toggleKind(kind)}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                active
                  ? 'border-border bg-accent text-foreground'
                  : 'border-border/40 text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon name={KIND_ICON[kind]} className="size-3.5" />
              {KIND_LABEL[kind]}
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant={ctrl.showOwns ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => ctrl.setShowOwns(!ctrl.showOwns)}
          title="Toggle the faint agent → component ownership links"
        >
          <Icon name="waypoints" />
          Ownership
        </Button>
        <Button
          variant={ctrl.showHeuristic ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => ctrl.setShowHeuristic(!ctrl.showHeuristic)}
          title="Show low-confidence links guessed from name mentions"
        >
          <Icon name="git-branch" />
          Guessed links
        </Button>
        <Button variant="ghost" size="sm" onClick={ctrl.reLayout}>
          <Icon name="layers" />
          Re-Layout
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void ctrl.refresh()}
          disabled={ctrl.loading}
        >
          <Icon name="refresh-cw" />
          {ctrl.loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
    </div>
  )
}
