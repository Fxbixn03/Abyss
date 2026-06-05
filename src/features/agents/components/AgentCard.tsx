import type { AgentAdapter, AgentCapabilities } from '@/shared/types/agent'
import { Badge } from '@/shared/components/ui/badge'
import { Card } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { useActiveAgentId } from '../hooks/useActiveAgent'
import { useAgentStore } from '../store/agent.store'

const CAPABILITY_LABELS: Record<keyof AgentCapabilities, string> = {
  instructions: 'Instructions',
  mcp: 'MCP',
  permissions: 'Permissions',
  modelEnv: 'Model & Env',
  agents: 'Agents',
  commands: 'Commands',
  skills: 'Skills',
  hooks: 'Hooks',
  rawSettings: 'Settings',
}

export function AgentCard({ agent }: { agent: AgentAdapter }) {
  const activeId = useActiveAgentId()
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const active = agent.id === activeId

  const capabilities = (
    Object.keys(CAPABILITY_LABELS) as (keyof AgentCapabilities)[]
  ).filter((key) => agent.capabilities[key])

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => setActiveAgent(agent.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setActiveAgent(agent.id)
      }}
      className={cn(
        'cursor-pointer p-4 transition-colors hover:border-primary/50',
        active && 'border-primary ring-1 ring-primary/40',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-lg',
            active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon name={agent.icon} className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{agent.displayName}</span>
            {active && (
              <Badge variant="success" className="font-code">
                active
              </Badge>
            )}
          </div>
          <span className="font-code text-xs text-muted-foreground">
            {agent.id}
          </span>
        </div>
      </div>
    </Card>
  )
}
