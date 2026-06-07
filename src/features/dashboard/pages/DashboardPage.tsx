import { useNavigate } from 'react-router-dom'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { Icon } from '@/shared/components/Icon'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import {
  useAgentAvailability,
  useAgentInstalled,
} from '@/features/agents/store/agent-availability.store'
import { AgentCard } from '@/features/agents/components/AgentCard'
import { AgentAvatar } from '@/features/agents/components/AgentAvatar'
import { useConfigBase } from '@/features/scope/hooks/useScopedBase'
import { ipc } from '@/shared/ipc/ipc.client'
import { UsagePanel } from '../components/UsagePanel'
import { StatusPreview } from '../components/StatusPreview'

export function DashboardPage() {
  const agent = useActiveAgent()
  const agents = useAllAgents()
  const basePath = useConfigBase(agent.id)
  const navigate = useNavigate()
  const installed = useAgentInstalled(agent.id)
  const availabilityLoaded = useAgentAvailability((s) => s.loaded)

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <PageHeader
        title={`Configure ${agent.displayName}`}
        description="One place to manage every AI coding agent on your machine."
        iconNode={<AgentAvatar agent={agent} className="size-9" />}
        actions={
          basePath ? (
            <button
              type="button"
              onClick={() => void ipc.revealPath(basePath)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-code text-xs text-muted-foreground hover:text-foreground"
              title="Reveal config directory"
            >
              <Icon name="folder-open" className="size-3.5" />
              <span className="max-w-[280px] truncate">{basePath}</span>
            </button>
          ) : (
            <Badge variant="warning">no config path</Badge>
          )
        }
      />

      {availabilityLoaded && !installed && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="alert-triangle" className="size-4 shrink-0" />
            <span>
              The <strong>{agent.displayName}</strong> CLI was not found on your
              system. Install it, or point Abyss at an existing config folder.
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => navigate('/settings')}
          >
            <Icon name="folder" />
            Set config path
          </Button>
        </div>
      )}

      <section data-tour="agent-grid" className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Agents</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      </section>

      <UsagePanel />
      <StatusPreview />
    </div>
  )
}
