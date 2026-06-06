import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { Badge } from '@/shared/components/ui/badge'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { useAgentStore } from '@/features/agents/store/agent.store'
import {
  isAgentEnabled,
  useAgentEnabled,
} from '@/features/agents/store/agent-enabled.store'
import { useAgentInstalled } from '@/features/agents/store/agent-availability.store'
import { AgentAvatar } from '@/features/agents/components/AgentAvatar'

function AgentRow({ agentId }: { agentId: string }) {
  const agent = agentRegistry.get(agentId)
  const enabledMap = useAgentEnabled((s) => s.enabled)
  const setEnabled = useAgentEnabled((s) => s.setEnabled)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const installed = useAgentInstalled(agentId)

  const on = isAgentEnabled(enabledMap, agentId)
  const enabledCount = agentRegistry
    .getAll()
    .filter((a) => isAgentEnabled(enabledMap, a.id)).length
  // Don't let the user disable the last enabled agent.
  const lastOne = on && enabledCount <= 1

  const toggle = (next: boolean) => {
    if (!next && lastOne) return
    setEnabled(agentId, next)
    // If we just disabled the active agent, switch to another enabled one.
    if (!next && activeAgentId === agentId) {
      const fallback = agentRegistry
        .getAll()
        .find((a) => a.id !== agentId && isAgentEnabled(enabledMap, a.id))
      if (fallback) setActiveAgent(fallback.id)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
      <AgentAvatar agent={agent} className="size-8" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{agent.displayName}</span>
          {installed ? (
            <Badge variant="success" className="font-code">
              installed
            </Badge>
          ) : (
            <Badge variant="muted">not installed</Badge>
          )}
        </div>
        <span className="font-code text-xs text-muted-foreground">
          {agent.id}
        </span>
      </div>
      <Switch
        checked={on}
        disabled={lastOne}
        onCheckedChange={toggle}
        aria-label={`Toggle ${agent.displayName}`}
      />
    </div>
  )
}

export function AgentsSection() {
  const agentIds = agentRegistry.getAll().map((a) => a.id)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agents</CardTitle>
        <CardDescription>
          Choose which agents appear in the app. Disabled agents are hidden
          everywhere (switcher, sidebar, compare, …). The last enabled agent
          can&apos;t be turned off.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {agentIds.map((id) => (
          <AgentRow key={id} agentId={id} />
        ))}
      </CardContent>
    </Card>
  )
}
