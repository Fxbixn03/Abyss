import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { KIND_ICON, KIND_TINT } from '../lib/nodeMeta'
import type { EntityFlowNode } from '../lib/toFlow'

/** A draggable component tile in the relations graph. */
export function EntityNode({ data, selected }: NodeProps<EntityFlowNode>) {
  const { node } = data
  const isHub = node.kind === 'agent'

  return (
    <div
      className={cn(
        'w-56 rounded-lg border bg-card px-3 py-2 shadow-sm transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
        isHub && 'border-primary/60 bg-primary/5',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-0 !bg-border"
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            KIND_TINT[node.kind],
          )}
        >
          <Icon name={KIND_ICON[node.kind]} className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-tight">
            {node.label}
          </div>
          {node.description && (
            <div className="truncate text-xs text-muted-foreground">
              {node.description}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border-0 !bg-border"
      />
    </div>
  )
}
