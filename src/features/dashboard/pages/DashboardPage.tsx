import { useNavigate } from 'react-router-dom'
import { Card } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { Icon } from '@/shared/components/Icon'
import {
  useActiveAgent,
  useAllAgents,
} from '@/features/agents/hooks/useActiveAgent'
import { AgentCard } from '@/features/agents/components/AgentCard'
import { AgentAvatar } from '@/features/agents/components/AgentAvatar'
import { useBasePath } from '@/features/settings/hooks/useBasePath'
import { ipc } from '@/shared/ipc/ipc.client'
import { UsagePanel } from '../components/UsagePanel'

interface QuickAction {
  label: string
  description: string
  icon: string
  route: string
}

export function DashboardPage() {
  const agent = useActiveAgent()
  const agents = useAllAgents()
  const basePath = useBasePath(agent.id)
  const navigate = useNavigate()

  const sections = agent.getSidebarSections?.() ?? []
  const quickActions: QuickAction[] = [
    {
      label: 'Instructions',
      description: `Edit ${agent.displayName} instruction files`,
      icon: 'file-text',
      route: '/config',
    },
    ...sections.map((s) => ({
      label: s.label,
      description: `Manage ${s.label.toLowerCase()}`,
      icon: s.icon,
      route: s.route,
    })),
  ]

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

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Agents</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      </section>

      <UsagePanel />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card
              key={action.route}
              role="button"
              tabIndex={0}
              onClick={() => navigate(action.route)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(action.route)
              }}
              className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon name={action.icon} className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{action.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <Icon
                name="chevron-right"
                className="ml-auto size-4 text-muted-foreground"
              />
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
