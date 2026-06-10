import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Icon } from '@/shared/components/Icon'
import { useRelations } from '../hooks/useRelations'
import { RelationsCanvas } from '../components/RelationsCanvas'
import { RelationsToolbar } from '../components/RelationsToolbar'
import { NodeInspector } from '../components/NodeInspector'

/**
 * Relations map — a pinboard of one agent's configurable components
 * (subagents, commands, skills, rules, hooks, MCP servers, instructions) with
 * inferred reference edges between them, and inline `.md` editing.
 */
export function RelationsPage() {
  const navigate = useNavigate()
  const ctrl = useRelations()

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
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-4">
        <RelationsCanvas
          nodes={ctrl.flowNodes}
          edges={ctrl.flowEdges}
          onSelect={ctrl.setSelectedId}
          onHover={ctrl.setHoveredId}
          onDragStop={ctrl.onDragStop}
        />
        <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card/40 p-4">
          <NodeInspector ctrl={ctrl} />
        </section>
      </div>
    </div>
  )
}
