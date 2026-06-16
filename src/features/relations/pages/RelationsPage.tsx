import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { useRelations } from '../hooks/useRelations'
import { RelationsCanvas } from '../components/RelationsCanvas'
import { RelationsToolbar } from '../components/RelationsToolbar'
import { NodeInspector } from '../components/NodeInspector'

const MIN_PREVIEW = 260
const MAX_PREVIEW = 680

/**
 * Relations map — a pinboard of one agent's configurable components
 * (subagents, commands, skills, rules, hooks, MCP servers, instructions) with
 * inferred reference edges between them, and inline `.md` editing.
 */
export function RelationsPage() {
  const navigate = useNavigate()
  const ctrl = useRelations()
  const [previewWidth, setPreviewWidth] = useState(360)
  const dragging = useRef(false)

  // Drag the divider to resize the preview; the graph takes the remaining width.
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    // Dragging left (negative movementX) widens the preview panel.
    setPreviewWidth((w) =>
      Math.min(MAX_PREVIEW, Math.max(MIN_PREVIEW, w - e.movementX)),
    )
  }
  const onHandleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (!ctrl.basePath) {
    return (
      <div className="flex h-full flex-col gap-4">
        <PageHeader title="Relations" icon="waypoints" />
        <EmptyState
          icon="folder"
          title="No config location set"
          description="Set a config directory in Settings to map this agent's components."
          action={
            <Button onClick={() => navigate('/settings')}>
              <Icon name="settings" />
              Open Settings
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Relations"
        icon="waypoints"
        description="How this agent's commands, subagents, skills, MCP servers and hooks connect"
      />
      <RelationsToolbar ctrl={ctrl} />
      <div className="flex min-h-0 flex-1 gap-0">
        <div className="min-w-0 flex-1">
          <RelationsCanvas
            nodes={ctrl.flowNodes}
            edges={ctrl.flowEdges}
            agentId={ctrl.agentId}
            onSelect={ctrl.setSelectedId}
            onHover={ctrl.setHoveredId}
            onDragStop={ctrl.onDragStop}
            registerExporter={ctrl.registerExporter}
          />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          className="group mx-1 flex w-2 shrink-0 cursor-col-resize items-center justify-center"
        >
          <div className="h-10 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
        </div>
        <section
          style={{ width: previewWidth }}
          className="flex min-h-0 shrink-0 flex-col rounded-lg border border-border bg-card/40 p-4"
        >
          <NodeInspector ctrl={ctrl} />
        </section>
      </div>
    </div>
  )
}
